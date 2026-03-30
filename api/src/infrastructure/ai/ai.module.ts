import { Module } from '@nestjs/common';
import { OpenAiCompletionService } from './openai-completion.service.js';
import { AnthropicCompletionService } from './anthropic-completion.service.js';
import { GeminiCompletionService } from './gemini-completion.service.js';
import { OpenRouterCompletionService } from './openrouter-completion.service.js';
import { AiCompletionStrategyService } from './ai-completion-strategy.service.js';
@Module({
  providers: [
    OpenAiCompletionService,
    AnthropicCompletionService,
    GeminiCompletionService,
    OpenRouterCompletionService,
    AiCompletionStrategyService,
    { provide: 'AiCompletionPort', useExisting: AiCompletionStrategyService },
  ],
  exports: ['AiCompletionPort'],
})
export class AiModule {}
