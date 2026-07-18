import { Injectable, Logger } from '@nestjs/common';
import type {
  ResolvedAiCompletionParams,
  AiCompletionResult,
  ChatMessage,
  ToolDefinition,
  ToolCall,
} from '../../application/ports/ai-completion.port.js';

@Injectable()
export class AnthropicCompletionService {
  private readonly logger = new Logger(AnthropicCompletionService.name);

  async complete(params: ResolvedAiCompletionParams): Promise<AiCompletionResult> {
    const url = 'https://api.anthropic.com/v1/messages';

    const messages = this.buildMessages(params.messages);

    const body: Record<string, unknown> = {
      model: params.model,
      system: params.systemPrompt,
      messages,
      max_tokens: params.maxTokens ?? 4096,
    };

    if (params.tools?.length) {
      body.tools = params.tools.map((t) => this.mapTool(t));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': params.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error: any) {
      this.logger.error(`Anthropic fetch failed: ${error.message}`);
      throw new Error(`Anthropic fetch failed: ${error.message}`, { cause: error });
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Anthropic API error: ${response.status} ${error}`);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text!)
      .join('');

    const toolCalls: ToolCall[] = data.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        arguments: c.input ?? {},
      }));

    this.logger.log(`Anthropic response: tokens=${data.usage.input_tokens + data.usage.output_tokens}, stop=${data.stop_reason}, toolCalls=${toolCalls.length}`);

    return {
      content: text || null,
      toolCalls,
      tokensUsed: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls'
        : data.stop_reason === 'end_turn' ? 'stop'
        : data.stop_reason === 'max_tokens' ? 'length'
        : 'other',
    };
  }

  /**
   * Anthropic requires alternating user/assistant messages.
   * Tool results must be sent as user messages with tool_result content blocks.
   */
  private buildMessages(messages: ChatMessage[]): any[] {
    const result: any[] = [];

    for (const m of messages) {
      if (m.role === 'user') {
        result.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        const content: any[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        if (m.toolCalls?.length) {
          for (const tc of m.toolCalls) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
          }
        }
        result.push({ role: 'assistant', content: content.length ? content : m.content });
      } else if (m.role === 'tool') {
        // Anthropic: tool results go as user messages with tool_result content blocks.
        // If the last message is already a user with tool_result blocks, append to it.
        const last = result[result.length - 1];
        const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
        if (last?.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
          last.content.push(block);
        } else {
          result.push({ role: 'user', content: [block] });
        }
      }
    }

    return result;
  }

  private mapTool(t: ToolDefinition): any {
    return { name: t.name, description: t.description, input_schema: t.parameters };
  }
}
