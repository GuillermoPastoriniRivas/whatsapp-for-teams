import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';
import { effectiveLimits } from './plan-resolution.util.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

// Los bots salieron: no son entidades que se prendan y apaguen, son nodos
// de una automatización. El tope se aplica al publicarla.
export type ResourceType = 'phone_numbers' | 'human_agents';

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
  ) {}

  async execute(input: ToggleResourceInput): Promise<Result<{ activated: string; deactivated?: string }, DomainError>> {
    const sub = await this.subscriptionRepo.findByTenantId(input.tenantId);
    const limits = effectiveLimits(sub);

    switch (input.resourceType) {
      case 'phone_numbers':
        return this.togglePhone(input, limits.maxPhoneNumbers);
      case 'human_agents':
        return this.toggleAgent(input, limits.maxHumanAgents);
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

}
