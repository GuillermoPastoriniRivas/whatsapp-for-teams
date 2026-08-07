import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { effectiveLimits, effectivePlan } from './plan-resolution.util.js';

export type PlanResource = 'phone_numbers' | 'human_agents' | 'ai_bots' | 'conversations' | 'flows';

export interface ResourceUsage {
  current: number;
  limit: number;
  allowed: boolean;
}

export interface FullUsage {
  plan: PlanTier;
  phoneNumbers: ResourceUsage;
  humanAgents: ResourceUsage;
  aiBots: ResourceUsage;
  conversations: ResourceUsage;
}

export class CheckPlanLimitUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly phoneNumberRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly aiAgentConfigRepo: AiAgentConfigRepository,
    private readonly flowRepo: FlowRepository,
  ) {}

  async checkResource(tenantId: string, resource: PlanResource): Promise<ResourceUsage> {
    const sub = await this.subscriptionRepo.findByTenantId(tenantId);
    const limits = effectiveLimits(sub);

    let current: number;
    let limit: number;

    switch (resource) {
      case 'phone_numbers':
        current = await this.phoneNumberRepo.countByTenantId(tenantId);
        limit = limits.maxPhoneNumbers;
        break;
      case 'human_agents':
        current = await this.agentRepo.countByTenantIdAndType(tenantId, AgentType.HUMAN);
        limit = limits.maxHumanAgents;
        break;
      case 'ai_bots':
        current = await this.agentRepo.countByTenantIdAndType(tenantId, AgentType.AI);
        limit = limits.maxAiBots;
        break;
      case 'conversations': {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        current = await this.conversationRepo.countByTenantIdSince(tenantId, monthStart);
        limit = limits.maxConversationsPerMonth;
        break;
      }
      case 'flows': {
        const published = await this.flowRepo.findPublishedByTenantId(tenantId);
        // La automatización base de cada número no se eligió: la crea el alta
        // del número y es la que decide quién atiende. Cobrarla contra la cuota
        // dejaría a un plan Free sin poder armar ni un flujo propio.
        current = published.filter((f) => !f.defaultForPhoneNumberId).length;
        limit = limits.maxActiveFlows;
        break;
      }
    }

    const allowed = limit === -1 || current < limit;
    return { current, limit, allowed };
  }

  async getFullUsage(tenantId: string): Promise<FullUsage> {
    const sub = await this.subscriptionRepo.findByTenantId(tenantId);
    // Tiene que ser el MISMO plan que usa checkResource: si acá se mira
    // `sub.plan` a secas, la pantalla muestra "Business" con límites de Free.
    const plan = effectivePlan(sub);

    const [phoneNumbers, humanAgents, aiBots, conversations] = await Promise.all([
      this.checkResource(tenantId, 'phone_numbers'),
      this.checkResource(tenantId, 'human_agents'),
      this.checkResource(tenantId, 'ai_bots'),
      this.checkResource(tenantId, 'conversations'),
    ]);

    return { plan, phoneNumbers, humanAgents, aiBots, conversations };
  }
}
