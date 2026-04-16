import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  Content,
  Part,
  FunctionCallPart,
  FunctionResponsePart,
} from '@google/generative-ai';
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
  private readonly genAI: GoogleGenerativeAI;
  private readonly maxToolRounds = 10; // safety limit on agentic loop iterations
  private readonly rateLimitMax = 30; // max requests per user per hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.genAI = new GoogleGenerativeAI(
      this.configService.get<string>('GEMINI_API_KEY') ?? '',
    );
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
      userId: userContext.userId,
      currentDate: new Date().toISOString().split('T')[0],
    });

    // 4. Get tool definitions
    const toolDefinitions = getToolDefinitions();

    // 5. Build Gemini model with system instruction and tools
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toolDefinitions }],
    });

    // 6. Build contents array from conversation history + new user message
    const existingMessages = (conversation.messages as any[]) ?? [];
    const contents: Content[] = [
      ...this.toGeminiContents(existingMessages),
      { role: 'user', parts: [{ text: dto.message }] },
    ];

    // 7. Agentic loop — keep calling Gemini until it stops requesting function calls
    const toolCalls: ToolCallRecord[] = [];
    let rounds = 0;

    let response;
    try {
      response = await model.generateContent({ contents });
    } catch (err) {
      this.logger.error('Gemini API call failed', err);
      throw new HttpException(
        'AI service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // The agentic loop: while Gemini requests function calls, execute them and continue
    while (rounds < this.maxToolRounds) {
      const candidate = response.response.candidates?.[0];
      if (!candidate) break;

      const functionCalls = (candidate.content?.parts ?? []).filter(
        (part): part is FunctionCallPart => 'functionCall' in part,
      );

      // No function calls — Gemini is done
      if (functionCalls.length === 0) break;

      rounds++;

      // Append the model's response (with function call parts) to contents
      contents.push({
        role: 'model',
        parts: candidate.content.parts,
      });

      // Execute each function call and build function response parts
      const functionResponses: FunctionResponsePart[] = [];

      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;

        this.logger.log(
          `Tool call [round ${rounds}]: ${name}(${JSON.stringify(args)})`,
        );

        let result: string;
        try {
          result = await executeTool(
            name,
            (args as Record<string, any>) ?? {},
            this.prisma,
            {
              userId: userContext.userId,
              role: userContext.role,
              branchId: userContext.branchId,
            },
          );
        } catch (err) {
          this.logger.error(`Tool execution error: ${name}`, err);
          result = JSON.stringify({
            error: `Tool execution failed: ${(err as Error).message}`,
          });
        }

        toolCalls.push({
          name,
          input: (args as Record<string, any>) ?? {},
          output: result,
        });

        let parsedResult: object;
        try {
          parsedResult = JSON.parse(result);
        } catch {
          this.logger.warn(`Tool ${name} returned non-JSON result, wrapping as text`);
          parsedResult = { text: result } as object;
        }

        functionResponses.push({
          functionResponse: {
            name,
            response: parsedResult,
          },
        });
      }

      // Append function responses and call Gemini again
      contents.push({
        role: 'user',
        parts: functionResponses,
      });

      try {
        response = await model.generateContent({ contents });
      } catch (err) {
        this.logger.error('Gemini API call failed during tool loop', err);
        throw new HttpException(
          'AI service temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    // 8. Extract the final text response
    const candidate = response.response.candidates?.[0];
    const textParts = (candidate?.content?.parts ?? []).filter(
      (part: Part) => 'text' in part,
    );
    const finalResponse = textParts.map((p: any) => p.text).join('\n');

    // Add final model message to contents for storage
    if (candidate) {
      contents.push({
        role: 'model',
        parts: candidate.content.parts,
      });
    }

    // 9. Save the updated conversation to the database
    const storedMessages = this.compactMessages(contents);

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

    // 10. Increment rate limit counter
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
    }

    return this.prisma.aiConversation.create({
      data: {
        userId,
        agentType,
        messages: [],
        metadata: { agentType },
      },
    });
  }

  /**
   * Convert stored messages (simple role/content pairs) into Gemini Content format.
   */
  private toGeminiContents(
    stored: Array<{ role: string; content: string }>,
  ): Content[] {
    return stored.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Extract user and model text messages from the full Gemini contents array
   * for compact storage. We only store simple role/content pairs, not
   * raw function call/response blocks.
   */
  private compactMessages(
    contents: Content[],
  ): Array<{ role: string; content: string }> {
    const compacted: Array<{ role: string; content: string }> = [];

    for (const content of contents) {
      const textParts = content.parts
        .filter((part) => 'text' in part)
        .map((part: any) => part.text);

      if (textParts.length > 0) {
        // Normalize Gemini 'model' role to 'assistant' for consistent storage
        const role = content.role === 'model' ? 'assistant' : content.role;
        compacted.push({ role, content: textParts.join('\n') });
      }
    }

    return compacted;
  }

  /**
   * Truncate long tool output strings for the response payload.
   * The full output is still sent to Gemini during the loop.
   */
  private truncateOutput(output: string, maxLen = 500): string {
    if (output.length <= maxLen) return output;
    return output.substring(0, maxLen) + '... (truncated)';
  }

  /**
   * Check per-user rate limiting (max N requests per hour).
   */
  private async checkRateLimit(userId: string) {
    const key = `ai:ratelimit:${userId}`;
    const count = await this.redis.get(key);
    if (count && parseInt(count, 10) >= this.rateLimitMax) {
      throw new HttpException(
        'Rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Increment the per-user rate limit counter with 1-hour TTL.
   */
  private async incrementRateLimit(userId: string) {
    const key = `ai:ratelimit:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600);
    }
  }
}
