import { Injectable } from '@nestjs/common';
import { AiProvider } from '../../domain/enums/ai-provider.enum.js';
import { AiCompletionPort, AiCompletionParams, AiCompletionResult } from '../../application/ports/ai-completion.port.js';
import { OpenAiCompletionService } from './openai-completion.service.js';
import { AnthropicCompletionService } from './anthropic-completion.service.js';
import { GeminiCompletionService } from './gemini-completion.service.js';
import { OpenRouterCompletionService } from './openrouter-completion.service.js';

@Injectable()
export class AiCompletionStrategyService implements AiCompletionPort {
  constructor(
    private readonly openaiService: OpenAiCompletionService,
    private readonly anthropicService: AnthropicCompletionService,
    private readonly geminiService: GeminiCompletionService,
    private readonly openrouterService: OpenRouterCompletionService,
  ) {}

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    switch (params.provider) {
      case AiProvider.OPENAI:
        return this.openaiService.complete(params);

      case AiProvider.ANTHROPIC:
        return this.anthropicService.complete(params);

      case AiProvider.GEMINI:
        return this.geminiService.complete(params);

      case AiProvider.OPENROUTER:
        return this.openrouterService.complete(params);

      default:
        throw new Error(`Unknown AI provider: ${params.provider}`);
    }
  }
}
