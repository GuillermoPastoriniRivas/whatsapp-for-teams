import type { BusinessProfile, BotBehavior, HandoffRules, AiContextConfig, AiRateLimits, BusinessHours } from '../../../domain/entities/ai-agent-config.entity.js';

export interface CreateAiAgentInput {
  tenantId: string;
  name: string;
  businessProfile: Partial<BusinessProfile> & Pick<BusinessProfile, 'vertical' | 'businessName'>;
  behavior?: Partial<BotBehavior>;
  handoffRules?: Partial<HandoffRules>;
  contextConfig?: Partial<AiContextConfig>;
  rateLimits?: Partial<AiRateLimits>;
  timezone?: string | null;
  businessHours?: BusinessHours | null;
}
