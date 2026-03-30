import type { HandoffRules } from '../entities/ai-agent-config.entity.js';

export interface HandoffResult {
  trigger: boolean;
  reason: string;
}

export class HandoffDetectionDomainService {
  shouldHandoff(
    messageBody: string,
    rules: HandoffRules,
    consecutiveFailures: number,
  ): HandoffResult {
    const lower = messageBody.toLowerCase();

    // Check explicit customer request for human
    if (rules.onCustomerRequest) {
      const humanPatterns = [
        'hablar con una persona',
        'hablar con un humano',
        'agente humano',
        'persona real',
        'talk to a human',
        'talk to a person',
        'real person',
        'human agent',
      ];
      for (const pattern of humanPatterns) {
        if (lower.includes(pattern)) {
          return { trigger: true, reason: `Customer requested a human agent: "${pattern}"` };
        }
      }
    }

    // Check configured keywords
    for (const keyword of rules.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return { trigger: true, reason: `Handoff keyword detected: "${keyword}"` };
      }
    }

    // Check urgency keywords
    for (const keyword of rules.urgencyKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return { trigger: true, reason: `Urgency keyword detected: "${keyword}"` };
      }
    }

    // Check consecutive failures
    if (rules.maxConsecutiveFailures > 0 && consecutiveFailures >= rules.maxConsecutiveFailures) {
      return { trigger: true, reason: `Max consecutive failures reached: ${consecutiveFailures}` };
    }

    return { trigger: false, reason: '' };
  }

  isLowConfidenceResponse(responseBody: string): boolean {
    const lower = responseBody.toLowerCase();
    const patterns = [
      'no tengo información',
      'no puedo ayudarte con eso',
      'no tengo esa información',
      'no estoy seguro',
      'no cuento con esa información',
      "i don't have information",
      "i'm not sure",
      "i can't help with that",
      'i don\'t know',
    ];
    return patterns.some((p) => lower.includes(p));
  }
}
