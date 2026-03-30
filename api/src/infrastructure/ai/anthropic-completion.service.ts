import { Injectable, Logger } from '@nestjs/common';
import type { AiCompletionParams, AiCompletionResult } from '../../application/ports/ai-completion.port.js';

@Injectable()
export class AnthropicCompletionService {
  private readonly logger = new Logger(AnthropicCompletionService.name);

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const url = 'https://api.anthropic.com/v1/messages';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 1024,
        system: params.systemPrompt,
        messages: params.messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Anthropic API error: ${response.status} ${error}`);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return {
      content: text,
      tokensUsed: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }
}
