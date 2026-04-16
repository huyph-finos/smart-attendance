export enum AgentType {
  HR_CHATBOT = 'hr_chatbot',
  ANOMALY_DETECTOR = 'anomaly_detector',
  REPORT_GENERATOR = 'report_generator',
  SHIFT_OPTIMIZER = 'shift_optimizer',
  PREDICTIVE = 'predictive',
}

export interface IAiMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: IAiToolCall[];
  timestamp: Date;
}

export interface IAiToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  duration?: number;
}

export interface IAiConversation {
  id: string;
  userId: string;
  agentType: AgentType;
  messages: IAiMessage[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
