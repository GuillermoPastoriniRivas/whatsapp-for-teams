import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';
import { effectiveLimits } from './plan-resolution.util.js';

export class EnforcePlanLimitsUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
  ) {}

  async execute(tenantId: string): Promise<void> {
    const sub = await this.subscriptionRepo.findByTenantId(tenantId);

    // Expired free trial: freeze all resources
    if (sub?.status === SubscriptionStatus.EXPIRED) {
      await Promise.all([
        this.enforcePhones(tenantId, 0),
        this.enforceHumanAgents(tenantId, 0),
      ]);
      return;
    }

    const limits = effectiveLimits(sub);

    await Promise.all([
      this.enforcePhones(tenantId, limits.maxPhoneNumbers),
      this.enforceHumanAgents(tenantId, limits.maxHumanAgents),
    ]);
    // Los bots ya no se congelan de a uno: un "bot" es una automatización
    // publicada con IA, y el tope se aplica al publicar (ver PublishFlowUseCase).
  }

  private async enforcePhones(tenantId: string, max: number): Promise<void> {
    const phones = await this.phoneRepo.findByTenantId(tenantId);
    if (max === -1) {
      // Unlimited — unfreeze all inactive phones
      for (const phone of phones) {
        if (phone.status === PhoneNumberStatus.INACTIVE) {
          await this.phoneRepo.update(phone.id, { status: PhoneNumberStatus.ACTIVE });
        }
      }
      return;
    }

    const active = phones.filter(p => p.status === PhoneNumberStatus.ACTIVE);
    const inactive = phones.filter(p => p.status === PhoneNumberStatus.INACTIVE);

    if (active.length > max) {
      // Freeze the most recently created active phones (keep oldest)
      const sorted = [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const toFreeze = sorted.slice(0, active.length - max);
      for (const phone of toFreeze) {
        await this.phoneRepo.update(phone.id, { status: PhoneNumberStatus.INACTIVE });
      }
    } else if (active.length < max) {
      // Unfreeze some inactive phones to fill up to the limit
      const toUnfreeze = inactive.slice(0, max - active.length);
      for (const phone of toUnfreeze) {
        await this.phoneRepo.update(phone.id, { status: PhoneNumberStatus.ACTIVE });
      }
    }
  }

  private async enforceHumanAgents(tenantId: string, max: number): Promise<void> {
    const agents = await this.agentRepo.findByTenantIdAndType(tenantId, AgentType.HUMAN);
    if (max === -1) {
      // Unlimited — unfreeze all
      for (const agent of agents) {
        if (agent.frozen) {
          await this.agentRepo.updateFrozen(agent.id, false);
        }
      }
      return;
    }

    const active = agents.filter(a => !a.frozen);
    const frozen = agents.filter(a => a.frozen);

    if (active.length > max) {
      const sorted = [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const toFreeze = sorted.slice(0, active.length - max);
      for (const agent of toFreeze) {
        await this.agentRepo.updateFrozen(agent.id, true);
      }
    } else if (active.length < max) {
      const toUnfreeze = frozen.slice(0, max - active.length);
      for (const agent of toUnfreeze) {
        await this.agentRepo.updateFrozen(agent.id, false);
      }
    }
  }

}
