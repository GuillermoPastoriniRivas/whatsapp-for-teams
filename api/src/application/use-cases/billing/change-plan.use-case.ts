import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { BillingRecordRepository } from '../../../domain/repositories/billing-record.repository.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { BillingEventType } from '../../../domain/enums/billing-event-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, SubscriptionNotFoundError } from '../../../domain/errors/domain-errors.js';
import { EnforcePlanLimitsUseCase } from './enforce-plan-limits.use-case.js';

const PLAN_ORDER: Record<PlanTier, number> = {
  [PlanTier.FREE]: 0,
  [PlanTier.PRO]: 1,
  [PlanTier.BUSINESS]: 2,
  [PlanTier.AGENCIES]: 3,
};

export interface ChangePlanInput {
  tenantId: string;
  newPlan: PlanTier;
}

export class ChangePlanUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly billingRecordRepo: BillingRecordRepository,
    private readonly enforceLimits: EnforcePlanLimitsUseCase,
  ) {}

  async execute(input: ChangePlanInput): Promise<Result<Subscription, DomainError>> {
    const existing = await this.subscriptionRepo.findByTenantId(input.tenantId);
    if (!existing) return err(new SubscriptionNotFoundError());

    const currentPlan = existing.plan;
    const newPlan = input.newPlan;

    if (currentPlan === newPlan) {
      // Same plan — if there's a scheduled downgrade, cancel it
      if (existing.scheduledPlan) {
        const updated = await this.subscriptionRepo.update(existing.id, { scheduledPlan: null });
        return ok(updated!);
      }
      return ok(existing);
    }

    const isUpgrade = PLAN_ORDER[newPlan] > PLAN_ORDER[currentPlan];

    // Free plan selection: any change (up or down) applies immediately, no payment.
    const updated = await this.subscriptionRepo.update(existing.id, {
      plan: input.newPlan,
      scheduledPlan: null, // No deferred downgrades in the free model
    });

    await this.billingRecordRepo.create({
      tenantId: input.tenantId,
      eventType: BillingEventType.PLAN_CHANGED,
      plan: input.newPlan,
      amountCents: 0,
      description: `${isUpgrade ? 'Upgraded' : 'Changed'} to ${input.newPlan} plan`,
    });

    await this.enforceLimits.execute(input.tenantId);

    return ok(updated!);
  }
}
