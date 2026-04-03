import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { PLAN_LIMITS } from '../../../domain/constants/plan-limits.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

export type ResourceType = 'phone_numbers' | 'human_agents' | 'ai_bots';

export interface ToggleResourceInput {
  tenantId: string;
  resourceType: ResourceType;
  activateId: string;
  deactivateId?: string;
}

export class ToggleResourceUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly aiConfigRepo: AiAgentConfigRepository,
  ) {}

  async execute(input: ToggleResourceInput): Promise<Result<{ activated: string; deactivated?: string }, DomainError>> {
    const sub = await this.subscriptionRepo.findByTenantId(input.tenantId);
    const plan = sub?.status === SubscriptionStatus.ACTIVE ? sub.plan : PlanTier.FREE;
    const limits = PLAN_LIMITS[plan];

    switch (input.resourceType) {
      case 'phone_numbers':
        return this.togglePhone(input, limits.maxPhoneNumbers);
      case 'human_agents':
        return this.toggleAgent(input, limits.maxHumanAgents);
      case 'ai_bots':
        return this.toggleAiBot(input, limits.maxAiBots);
    }
  }

  private async togglePhone(input: ToggleResourceInput, max: number): Promise<Result<{ activated: string; deactivated?: string }, DomainError>> {
    if (max === -1) {
      await this.phoneRepo.update(input.activateId, { status: PhoneNumberStatus.ACTIVE });
      return ok({ activated: input.activateId });
    }

    if (input.deactivateId) {
      await this.phoneRepo.update(input.deactivateId, { status: PhoneNumberStatus.INACTIVE });
    } else {
      const activeCount = await this.phoneRepo.countByTenantId(input.tenantId);
      // countByTenantId counts all, we need active only
      const phones = await this.phoneRepo.findByTenantId(input.tenantId);
      const activePhones = phones.filter(p => p.status === PhoneNumberStatus.ACTIVE).length;
      if (activePhones >= max) {
        return err(new DomainError('PLAN_LIMIT_EXCEEDED', `Cannot activate: ${activePhones}/${max} phone numbers active. Deactivate one first.`));
      }
    }

    await this.phoneRepo.update(input.activateId, { status: PhoneNumberStatus.ACTIVE });
    return ok({ activated: input.activateId, deactivated: input.deactivateId });
  }

  private async toggleAgent(input: ToggleResourceInput, max: number): Promise<Result<{ activated: string; deactivated?: string }, DomainError>> {
    if (max === -1) {
      await this.agentRepo.updateFrozen(input.activateId, false);
      return ok({ activated: input.activateId });
    }

    if (input.deactivateId) {
      await this.agentRepo.updateFrozen(input.deactivateId, true);
    } else {
      const agents = await this.agentRepo.findByTenantId(input.tenantId);
      const activeHumans = agents.filter(a => a.type === 'human' && !a.frozen).length;
      if (activeHumans >= max) {
        return err(new DomainError('PLAN_LIMIT_EXCEEDED', `Cannot activate: ${activeHumans}/${max} agents active. Freeze one first.`));
      }
    }

    await this.agentRepo.updateFrozen(input.activateId, false);
    return ok({ activated: input.activateId, deactivated: input.deactivateId });
  }

  private async toggleAiBot(input: ToggleResourceInput, max: number): Promise<Result<{ activated: string; deactivated?: string }, DomainError>> {
    if (max === -1) {
      await this.aiConfigRepo.update(input.activateId, { isActive: true });
      return ok({ activated: input.activateId });
    }

    if (input.deactivateId) {
      await this.aiConfigRepo.update(input.deactivateId, { isActive: false });
    } else {
      const configs = await this.aiConfigRepo.findByTenantId(input.tenantId);
      const activeCount = configs.filter(c => c.isActive).length;
      if (activeCount >= max) {
        return err(new DomainError('PLAN_LIMIT_EXCEEDED', `Cannot activate: ${activeCount}/${max} AI bots active. Deactivate one first.`));
      }
    }

    await this.aiConfigRepo.update(input.activateId, { isActive: true });
    return ok({ activated: input.activateId, deactivated: input.deactivateId });
  }
}
