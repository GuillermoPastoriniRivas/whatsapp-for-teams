import { Injectable, Logger } from '@nestjs/common';
import type { AiCompletionParams, AiCompletionResult } from '../../application/ports/ai-completion.port.js';

@Injectable()
export class OpenRouterCompletionService {
  private readonly logger = new Logger(OpenRouterCompletionService.name);

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const messages = [
      { role: 'system', content: params.systemPrompt },
      ...params.messages,
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} ${error}`);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      content: data.choices[0].message.content,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
    };
  }
}
