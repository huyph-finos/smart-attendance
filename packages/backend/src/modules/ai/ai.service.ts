import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChatDto } from './dto/chat.dto';
import { getToolDefinitions } from './tools/tool-registry';
import { executeTool } from './tools/tool-executor';
import { getAgentPrompt } from './agents/agent-prompts';

/**
 * Tracks a single tool invocation during the agentic loop.
 */
interface ToolCallRecord {
  name: string;
  input: Record<string, any>;
  output: string;
}

/**
 * The user context passed into tool execution for access-control scoping.
 */
interface UserContext {
  userId: string;
  role: string;
  branchId?: string;
  firstName?: string;
  lastName?: string;
  branchName?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly maxToolRounds = 10; // safety limit on agentic loop iterations
  private readonly rateLimitMax = 30; // max requests per user per hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  // ---------------------------------------------------------------------------
  // Main chat endpoint — the agentic loop
  // ---------------------------------------------------------------------------

  async chat(userId: string, dto: ChatDto, userContext: UserContext) {
    // 1. Rate limiting
    await this.checkRateLimit(userId);

    // 2. Get or create conversation
    const conversation = await this.getOrCreateConversation(
      userId,
      dto.conversationId,
      dto.agentType,
    );

    // 3. Build the system prompt with user context
    const systemPrompt = getAgentPrompt(dto.agentType, {
      name: `${userContext.firstName ?? ''} ${userContext.lastName ?? ''}`.trim() || 'User',
      role: userContext.role,
      branch: userContext.branchName,
      userId,
    });

    // 4. Get tool definitions
    const toolDefinitions = getToolDefinitions();

    // 5. Build messages array from conversation history + new user message
    const existingMessages = (conversation.messages as any[]) ?? [];
    const messages: Anthropic.Messages.MessageParam[] = [
      ...existingMessages,
      { role: 'user', content: dto.message },
    ];

    // 6. Agentic loop — keep calling Claude until it stops requesting tools
    const toolCalls: ToolCallRecord[] = [];
    let rounds = 0;
    let response: Anthropic.Messages.Message;

    try {
      response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: toolDefinitions,
        messages,
      });
    } catch (err) {
      this.logger.error('Anthropic API call failed', err);
      throw new HttpException(
        'AI service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // The agentic loop: while Claude requests tool use, execute tools and continue
    while (response.stop_reason === 'tool_use' && rounds < this.maxToolRounds) {
      rounds++;

      // Append the assistant's response (which contains tool_use blocks) to messages
      messages.push({ role: 'assistant', content: response.content });

      // Process every tool_use block in this response
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        this.logger.log(
          `Tool call [round ${rounds}]: ${block.name}(${JSON.stringify(block.input)})`,
        );

        let result: string;
        try {
          result = await executeTool(
            block.name,
            block.input as Record<string, any>,
            this.prisma,
            {
              userId: userContext.userId,
              role: userContext.role,
              branchId: userContext.branchId,
            },
          );
        } catch (err) {
          this.logger.error(`Tool execution error: ${block.name}`, err);
          result = JSON.stringify({
            error: `Tool execution failed: ${(err as Error).message}`,
          });
        }

        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, any>,
          output: result,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      // Append tool results as the next user message and call Claude again
      messages.push({ role: 'user', content: toolResults });

      try {
        response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools: toolDefinitions,
          messages,
        });
      } catch (err) {
        this.logger.error('Anthropic API call failed during tool loop', err);
        throw new HttpException(
          'AI service temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    // 7. Extract the final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
    );
    const finalResponse = textBlocks.map((b) => b.text).join('\n');

    // Add the final assistant message to the conversation
    messages.push({ role: 'assistant', content: response.content });

    // 8. Save the updated conversation to the database
    // We store only the user/assistant text messages (not raw tool blocks)
    // to keep the stored history manageable
    const storedMessages = this.compactMessages(messages);

    await this.prisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        messages: storedMessages as any,
        metadata: {
          lastAgentType: dto.agentType,
          totalToolCalls: toolCalls.length,
          lastUpdated: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    // 9. Increment rate limit counter
    await this.incrementRateLimit(userId);

    return {
      conversationId: conversation.id,
      response: finalResponse,
      toolCalls: toolCalls.map((tc) => ({
        name: tc.name,
        input: tc.input,
        output: this.truncateOutput(tc.output),
      })),
      agentType: dto.agentType,
    };
  }

  // ---------------------------------------------------------------------------
  // Conversation management
  // ---------------------------------------------------------------------------

  async getConversations(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        agentType: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
    }

    return conversation;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieve an existing conversation or create a new one.
   */
  private async getOrCreateConversation(
    userId: string,
    conversationId: string | undefined,
    agentType: string,
  ) {
    if (conversationId) {
      const existing = await this.prisma.aiConversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (existing) return existing;
      // If not found, fall through and create a new one
    }

    return this.prisma.aiConversation.create({
      data: {
        userId,
        agentType,
        messages: [],
      },
    });
  }

  /**
   * Compact the full message history into a storable format.
   * Keeps user text messages and assistant text responses.
   * Tool use/result blocks are summarized to save space.
   */
  private compactMessages(
    messages: Anthropic.Messages.MessageParam[],
  ): Array<{ role: string; content: string }> {
    const compacted: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        compacted.push({ role: msg.role, content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Extract text blocks from content arrays
        const textParts = msg.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text);

        if (textParts.length > 0) {
          compacted.push({ role: msg.role, content: textParts.join('\n') });
        }
        // Skip pure tool_use/tool_result messages to keep history lean
      }
    }

    return compacted;
  }

  /**
   * Truncate long tool output strings for the response payload.
   * The full output is still sent to Claude during the loop.
   */
  private truncateOutput(output: string, maxLen = 500): string {
    if (output.length <= maxLen) return output;
    return output.substring(0, maxLen) + '... (truncated)';
  }

  /**
   * Check if the user has exceeded the hourly rate limit.
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const key = `ai:rate:${userId}`;
    const current = await this.redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= this.rateLimitMax) {
      throw new HttpException(
        `Rate limit exceeded. Maximum ${this.rateLimitMax} AI requests per hour.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Increment the rate limit counter for the user.
   * Key expires after 1 hour automatically.
   */
  private async incrementRateLimit(userId: string): Promise<void> {
    const key = `ai:rate:${userId}`;
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, 3600); // 1 hour TTL
    await pipeline.exec();
  }
}
