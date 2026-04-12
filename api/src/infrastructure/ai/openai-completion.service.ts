import { Injectable, Logger } from '@nestjs/common';
import type {
  AiCompletionParams,
  AiCompletionResult,
  ChatMessage,
  ToolDefinition,
  ToolCall,
} from '../../application/ports/ai-completion.port.js';

@Injectable()
export class OpenAiCompletionService {
  private readonly logger = new Logger(OpenAiCompletionService.name);

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const url = 'https://api.openai.com/v1/chat/completions';

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

    this.logger.log(`OpenAI request: model=${params.model}, messages=${messages.length}, tools=${params.tools?.length ?? 0}`);

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
      const cause = error.cause ? ` | cause: ${error.cause.message ?? error.cause}` : '';
      this.logger.error(`OpenAI fetch failed: ${error.message}${cause} (model=${params.model})`);
      throw new Error(`OpenAI fetch failed: ${error.message}${cause}`, { cause: error });
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenAI API error: ${response.status} ${error}`);
      throw new Error(`OpenAI API error: ${response.status}`);
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

    this.logger.log(`OpenAI response: tokens=${data.usage.total_tokens}, finish=${choice.finish_reason}, toolCalls=${toolCalls.length}`);

    return {
      content: choice.message.content,
      toolCalls,
      tokensUsed: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
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

  private mapFinishReason(reason: string): AiCompletionResult['finishReason'] {
    if (reason === 'stop') return 'stop';
    if (reason === 'tool_calls') return 'tool_calls';
    if (reason === 'length') return 'length';
    return 'other';
  }
}
