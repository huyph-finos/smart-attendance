import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const AGENT_TYPES = [
  'hr_chatbot',
  'anomaly_detector',
  'report_generator',
  'shift_optimizer',
  'predictive',
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

export class ChatDto {
  @ApiProperty({ description: 'User message to the AI agent' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Agent type to use',
    enum: AGENT_TYPES,
    default: 'hr_chatbot',
  })
  @IsOptional()
  @IsString()
  @IsIn(AGENT_TYPES)
  agentType: AgentType = 'hr_chatbot';

  @ApiPropertyOptional({
    description: 'Conversation ID to continue an existing conversation',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
