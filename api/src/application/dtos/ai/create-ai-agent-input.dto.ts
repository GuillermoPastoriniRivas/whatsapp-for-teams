import { AiProvider } from '../../../domain/enums/ai-provider.enum.js';
import type { AiPersona, HandoffRules, AiContextConfig, AiRateLimits } from '../../../domain/entities/ai-agent-config.entity.js';

export interface CreateAiAgentInput {
  tenantId: string;
  name: string;
  provider: AiProvider;
  model: string;
  apiKey: string;
  systemPrompt?: string;
  knowledgeBase?: string;
  goals?: string;
  persona: AiPersona;
  handoffRules?: Partial<HandoffRules>;
  contextConfig?: Partial<AiContextConfig>;
  rateLimits?: Partial<AiRateLimits>;
}
