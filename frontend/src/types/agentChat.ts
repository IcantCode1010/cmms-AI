export interface AgentChatMessage {
  role: string;
  content: string;
}

export interface AgentToolCall {
  toolName: string;
  arguments?: Record<string, unknown>;
  resultCount?: number;
  status?: string;
  error?: string;
}

export interface AgentDraftAction {
  id: number;
  agentSessionId: string;
  operationType: string;
  payload: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentChatResponse {
  status: string;
  message?: string;
  agentId?: string;
  correlationId?: string;
  sessionId?: string;
  messages?: AgentChatMessage[];
  drafts?: AgentDraftAction[];
  toolCalls?: AgentToolCall[];
}
