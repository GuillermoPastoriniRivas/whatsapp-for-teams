import { Injectable, Logger } from '@nestjs/common';
import type {
  AiCompletionParams,
  AiCompletionResult,
  ChatMessage,
  ToolDefinition,
  ToolCall,
} from '../../application/ports/ai-completion.port.js';

@Injectable()
export class GeminiCompletionService {
  private readonly logger = new Logger(GeminiCompletionService.name);

  async complete(params: AiCompletionParams): Promise<AiCompletionResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

    const contents = params.messages.map((m) => this.mapMessage(m));

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: params.systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: params.maxTokens ?? 4096,
      },
    };

    if (params.tools?.length) {
      body.tools = [{ functionDeclarations: params.tools.map((t) => this.mapTool(t)) }];
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error: any) {
      this.logger.error(`Gemini fetch failed: ${error.message}`);
      throw new Error(`Gemini fetch failed: ${error.message}`, { cause: error });
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Gemini API error: ${response.status} ${error}`);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
        finishReason?: string;
      }>;
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    };

    const parts = data.candidates[0].content.parts;
    const text = parts.filter((p) => p.text).map((p) => p.text!).join('');

    // Gemini matches tool results by function name (not by ID).
    // We use the function name as the ID so that when we send the result back,
    // the functionResponse.name matches what Gemini expects.
    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall)
      .map((p) => ({
        id: p.functionCall!.name,
        name: p.functionCall!.name,
        arguments: p.functionCall!.args ?? {},
      }));

    const finishReason = data.candidates[0].finishReason;

    this.logger.log(`Gemini response: tokens=${data.usageMetadata?.totalTokenCount ?? 0}, finish=${finishReason}, toolCalls=${toolCalls.length}`);

    return {
      content: text || null,
      toolCalls,
      tokensUsed: {
        prompt: data.usageMetadata?.promptTokenCount ?? 0,
        completion: data.usageMetadata?.candidatesTokenCount ?? 0,
        total: data.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: toolCalls.length > 0 ? 'tool_calls'
        : finishReason === 'STOP' ? 'stop'
        : finishReason === 'MAX_TOKENS' ? 'length'
        : 'other',
    };
  }

  private mapMessage(m: ChatMessage): any {
    if (m.role === 'tool') {
      // Gemini matches tool results by function name.
      // We set id = name when parsing tool calls, so toolCallId IS the function name.
      return {
        role: 'user',
        parts: [{ functionResponse: { name: m.toolCallId, response: { result: m.content } } }],
      };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
      }
      return { role: 'model', parts };
    }
    if (m.role === 'assistant') {
      return { role: 'model', parts: [{ text: m.content ?? '' }] };
    }
    return { role: 'user', parts: [{ text: m.content }] };
  }

  private mapTool(t: ToolDefinition): any {
    return { name: t.name, description: t.description, parameters: t.parameters };
  }
}
