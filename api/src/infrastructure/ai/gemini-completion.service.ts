import { Injectable, Logger } from '@nestjs/common';
import type { AiCompletionParams, AiCompletionResult } from '../../application/ports/ai-completion.port.js';

@Injectable()
export class GeminiCompletionService {
  private readonly logger = new Logger(GeminiCompletionService.name);

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

    const contents = params.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: params.maxTokens ?? 1024,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Gemini API error: ${response.status} ${error}`);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    };

    const text = data.candidates[0].content.parts.map((p) => p.text).join('');

    return {
      content: text,
      tokensUsed: {
        prompt: data.usageMetadata?.promptTokenCount ?? 0,
        completion: data.usageMetadata?.candidatesTokenCount ?? 0,
        total: data.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }
}
