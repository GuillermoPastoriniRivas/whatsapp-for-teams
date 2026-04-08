import { Injectable, Logger } from '@nestjs/common';
import type { AiCompletionParams, AiCompletionResult } from '../../application/ports/ai-completion.port.js';

@Injectable()
export class OpenAiCompletionService {
  private readonly logger = new Logger(OpenAiCompletionService.name);

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const url = 'https://api.openai.com/v1/chat/completions';

    const messages = [
      { role: 'system', content: params.systemPrompt },
      ...params.messages,
    ];

    this.logger.log(`OpenAI request: model=${params.model}, messages=${messages.length}, systemPrompt=${params.systemPrompt.length} chars`);

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
      this.logger.error(`OpenAI API error: ${response.status} ${error}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    this.logger.log(`OpenAI response: tokens=${data.usage.total_tokens} (prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens})`);
    this.logger.debug(`OpenAI response content: ${data.choices[0].message.content.substring(0, 200)}`);

    return {
      content: data.choices[0].message.content,
      tokensUsed: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
    };
  }
}
