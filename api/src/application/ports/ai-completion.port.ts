import { AiProvider } from '../../domain/enums/ai-provider.enum.js';

export interface AiCompletionParams {
  provider: AiProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}

export interface AiCompletionResult {
  content: string;
  tokensUsed: { prompt: number; completion: number; total: number };
}

export interface AiCompletionPort {
  complete(params: AiCompletionParams): Promise<AiCompletionResult>;
}
