import { Injectable, Logger } from '@nestjs/common';
import type {
  ResolvedAiCompletionParams,
  AiCompletionResult,
  ChatMessage,
  ToolDefinition,
  ToolCall,
} from '../../application/ports/ai-completion.port.js';

/**
 * OpenRouter uses the OpenAI-compatible API format.
 */
@Injectable()
export class OpenRouterCompletionService {
  private readonly logger = new Logger(OpenRouterCompletionService.name);

  async complete(params: ResolvedAiCompletionParams): Promise<AiCompletionResult> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const messages: any[] = [
      { role: 'system', content: params.systemPrompt },
      ...params.messages.map((m) => this.mapMessage(m)),
    ];

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
    };

    if (params.tools?.length) {
      body.tools = params.tools.map((t) => this.mapTool(t));
    }

    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error: any) {
      this.logger.error(`OpenRouter fetch failed: ${error.message}`);
      throw new Error(`OpenRouter fetch failed: ${error.message}`, { cause: error });
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} ${error}`);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = data.choices[0];
    const toolCalls = this.parseToolCalls(choice.message.tool_calls);

    this.logger.log(`OpenRouter response: tokens=${data.usage?.total_tokens ?? 0}, finish=${choice.finish_reason}, toolCalls=${toolCalls.length}`);

    return {
      content: choice.message.content,
      toolCalls,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason === 'stop' ? 'stop'
        : choice.finish_reason === 'tool_calls' ? 'tool_calls'
        : choice.finish_reason === 'length' ? 'length'
        : 'other',
    };
  }

  private mapMessage(m: ChatMessage): any {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  }

  private mapTool(t: ToolDefinition): any {
    return {
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    };
  }

  private parseToolCalls(raw?: Array<{ id: string; function: { name: string; arguments: string } }>): ToolCall[] {
    if (!raw?.length) return [];
    return raw.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: this.safeParse(tc.function.arguments),
    }));
  }

  private safeParse(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json);
    } catch {
      this.logger.warn(`Failed to parse tool call arguments: ${json.substring(0, 200)}`);
      return {};
    }
  }
}
