import { AiProvider } from '../../domain/enums/ai-provider.enum.js';

// ── Tool Calling Types ──────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultMessage {
  role: 'tool';
  toolCallId: string;
  content: string;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | ToolResultMessage;

// ── Completion Types ────────────────────────────────────────────────────

export interface AiCompletionParams {
  provider: AiProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
}

export interface AiCompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
  tokensUsed: { prompt: number; completion: number; total: number };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'other';
}

export interface AiCompletionPort {
  complete(params: AiCompletionParams): Promise<AiCompletionResult>;
}
