import { Injectable, Logger } from '@nestjs/common';
import { AiProvider } from '../../domain/enums/ai-provider.enum.js';
import { AiCompletionPort, AiCompletionParams, AiCompletionResult, ResolvedAiCompletionParams } from '../../application/ports/ai-completion.port.js';
import { OpenAiCompletionService } from './openai-completion.service.js';
import { AnthropicCompletionService } from './anthropic-completion.service.js';
import { GeminiCompletionService } from './gemini-completion.service.js';
import { OpenRouterCompletionService } from './openrouter-completion.service.js';

const DEFAULT_MODELS: Record<AiProvider, string> = {
  [AiProvider.ANTHROPIC]: 'claude-opus-4-8',
  [AiProvider.OPENAI]: 'gpt-4o',
  [AiProvider.GEMINI]: 'gemini-2.0-flash',
  [AiProvider.OPENROUTER]: 'anthropic/claude-opus-4-8',
};

/**
 * The LLM is a platform concern: one provider, one model, one API key,
 * configured via env (AI_PROVIDER, AI_MODEL, AI_API_KEY). Tenants never
 * choose or supply any of this.
 */
@Injectable()
export class AiCompletionStrategyService implements AiCompletionPort {
  private readonly logger = new Logger(AiCompletionStrategyService.name);

  constructor(
    private readonly openaiService: OpenAiCompletionService,
    private readonly anthropicService: AnthropicCompletionService,
    private readonly geminiService: GeminiCompletionService,
    private readonly openrouterService: OpenRouterCompletionService,
  ) {}

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const provider = (process.env.AI_PROVIDER as AiProvider) || AiProvider.ANTHROPIC;
    const apiKey = process.env.AI_API_KEY ?? '';
    const model = process.env.AI_MODEL || DEFAULT_MODELS[provider];

    if (!apiKey) {
      this.logger.error('AI_API_KEY is not configured — cannot run AI completions');
      throw new Error('AI platform key not configured (AI_API_KEY)');
    }

    const resolved: ResolvedAiCompletionParams = { ...params, provider, model, apiKey };

    switch (provider) {
      case AiProvider.OPENAI:
        return this.openaiService.complete(resolved);

      case AiProvider.ANTHROPIC:
        return this.anthropicService.complete(resolved);

      case AiProvider.GEMINI:
        return this.geminiService.complete(resolved);

      case AiProvider.OPENROUTER:
        return this.openrouterService.complete(resolved);

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }
}
