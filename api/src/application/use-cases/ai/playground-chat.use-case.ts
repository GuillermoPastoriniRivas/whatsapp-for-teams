import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { AiCompletionPort } from '../../ports/ai-completion.port.js';
import type { ChatMessage } from '../../ports/ai-completion.port.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError, DomainError } from '../../../domain/errors/domain-errors.js';
import { buildSystemPrompt } from './prompts/system-prompt.builder.js';
import { computeBusinessStatus } from './prompts/business-hours.util.js';

export interface PlaygroundChatInput {
  agentId: string;
  tenantId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface PlaygroundChatOutput {
  bubbles: string[];
  tokensUsed: { prompt: number; completion: number; total: number };
}

/**
 * Stateless test chat: runs the SAME system prompt compiler used in
 * production (minus contact/labels/tools) so what the owner sees in the
 * playground is what customers will get on WhatsApp.
 */
export class PlaygroundChatUseCase {
  constructor(
    private readonly configRepo: AiAgentConfigRepository,
    private readonly aiCompletion: AiCompletionPort,
  ) {}

  async execute(input: PlaygroundChatInput): Promise<Result<PlaygroundChatOutput, DomainError>> {
    const config = await this.configRepo.findByAgentId(input.agentId);
    if (!config || config.tenantId !== input.tenantId) return err(new AgentNotFoundError());

    const now = new Date();
    const tz = config.timezone ?? undefined;
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz };
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz };
    const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz });
    const businessStatus = computeBusinessStatus(config.businessHours, config.timezone, now);

    const systemPrompt = buildSystemPrompt({
      currentDay: weekdayFmt.format(now),
      currentDate: now.toLocaleDateString('en-US', dateOpts),
      currentTime: now.toLocaleTimeString('en-US', timeOpts),
      businessStatus: businessStatus ? {
        isOpen: businessStatus.isOpen,
        todayRange: businessStatus.todayRange,
        nextOpen: businessStatus.nextOpen,
      } : null,
      businessProfile: config.businessProfile,
      behavior: config.behavior,
      handoffRules: {
        keywords: config.handoffRules.keywords,
        urgencyKeywords: config.handoffRules.urgencyKeywords,
        onCustomerRequest: config.handoffRules.onCustomerRequest,
      },
      labels: [],
      multiMessage: config.multiMessage?.enabled ? { enabled: true, maxBubbles: config.multiMessage.maxBubbles } : undefined,
    });

    const chatMessages: ChatMessage[] = input.messages.map((m) =>
      m.role === 'user'
        ? { role: 'user' as const, content: m.content }
        : { role: 'assistant' as const, content: m.content },
    );

    const result = await this.aiCompletion.complete({
      systemPrompt,
      messages: chatMessages,
    });

    const raw = result.content ?? '';
    const bubbles = config.multiMessage?.enabled
      ? this.parseBubbles(raw, config.multiMessage.maxBubbles)
      : [raw];

    return ok({ bubbles, tokensUsed: result.tokensUsed });
  }

  private parseBubbles(raw: string, maxBubbles: number): string[] {
    const tryParse = (str: string): string[] | null => {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((s: unknown) => typeof s === 'string')) {
          return parsed;
        }
      } catch { /* fall through */ }
      return null;
    };

    let result = tryParse(raw);
    if (result) return result.slice(0, maxBubbles);

    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      result = tryParse(fenceMatch[1].trim());
      if (result) return result.slice(0, maxBubbles);
    }

    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      result = tryParse(arrayMatch[0]);
      if (result) return result.slice(0, maxBubbles);
    }

    return [raw];
  }
}
