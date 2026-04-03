import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { BillingRecordRepository } from '../../../domain/repositories/billing-record.repository.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { BillingEventType } from '../../../domain/enums/billing-event-type.enum.js';
import { PLAN_LIMITS } from '../../../domain/constants/plan-limits.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, SubscriptionNotFoundError } from '../../../domain/errors/domain-errors.js';
import { EnforcePlanLimitsUseCase } from './enforce-plan-limits.use-case.js';

const PLAN_ORDER: Record<PlanTier, number> = {
  [PlanTier.FREE]: 0,
  [PlanTier.PRO]: 1,
  [PlanTier.BUSINESS]: 2,
  [PlanTier.AGENCIES]: 3,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

    if (isUpgrade) {
      return this.handleUpgrade(existing, input);
    } else {
      return this.handleDowngrade(existing, input);
    }
  }

  private async handleUpgrade(existing: Subscription, input: ChangePlanInput): Promise<Result<Subscription, DomainError>> {
    const now = new Date();
    const periodEnd = existing.currentPeriodEnd;
    const daysRemaining = Math.max(0, (periodEnd.getTime() - now.getTime()) / MS_PER_DAY);

    const currentPrice = PLAN_LIMITS[existing.plan].priceMonthly;
    const newPrice = PLAN_LIMITS[input.newPlan].priceMonthly;

    // Prorate: credit for unused days on current plan, charge for remaining days on new plan
    const credit = Math.round((currentPrice / 30) * daysRemaining);
    const cost = Math.round((newPrice / 30) * daysRemaining);
    const charge = Math.max(0, cost - credit);

    // Activate new plan immediately, keep same period end
    const updated = await this.subscriptionRepo.update(existing.id, {
      plan: input.newPlan,
      scheduledPlan: null, // Clear any pending downgrade
    });

    await this.billingRecordRepo.create({
      tenantId: input.tenantId,
      eventType: BillingEventType.PLAN_CHANGED,
      plan: input.newPlan,
      amountCents: charge,
      description: `Upgraded to ${input.newPlan} (prorated ${Math.round(daysRemaining)} days remaining)`,
    });

    if (charge > 0) {
      await this.billingRecordRepo.create({
        tenantId: input.tenantId,
        eventType: BillingEventType.PAYMENT_SUCCESS,
        plan: input.newPlan,
        amountCents: charge,
        description: `Prorated payment for ${input.newPlan} — $${(charge / 100).toFixed(2)}`,
      });
    }

    await this.enforceLimits.execute(input.tenantId);

    return ok(updated!);
  }

  private async handleDowngrade(existing: Subscription, input: ChangePlanInput): Promise<Result<Subscription, DomainError>> {
    // Schedule downgrade for end of current period — don't change plan now
    const updated = await this.subscriptionRepo.update(existing.id, {
      scheduledPlan: input.newPlan,
    });

    const effectiveDate = existing.currentPeriodEnd.toISOString().slice(0, 10);

    await this.billingRecordRepo.create({
      tenantId: input.tenantId,
      eventType: BillingEventType.PLAN_CHANGED,
      plan: input.newPlan,
      amountCents: 0,
      description: `Downgrade to ${input.newPlan} scheduled for ${effectiveDate}`,
    });

    // Don't enforce limits yet — current plan stays active until period end

    return ok(updated!);
  }
}
