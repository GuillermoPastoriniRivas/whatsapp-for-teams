import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { BillingRecordRepository } from '../../../domain/repositories/billing-record.repository.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { BillingEventType } from '../../../domain/enums/billing-event-type.enum.js';
import { PLAN_LIMITS, PlanLimits } from '../../../domain/constants/plan-limits.js';
import { EnforcePlanLimitsUseCase } from './enforce-plan-limits.use-case.js';

export interface SubscriptionInfo {
  subscription: Subscription | null;
  plan: PlanTier;
  limits: PlanLimits;
}

export class GetSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly billingRecordRepo: BillingRecordRepository,
    private readonly enforceLimits: EnforcePlanLimitsUseCase,
  ) {}

  async execute(tenantId: string): Promise<SubscriptionInfo> {
    let subscription = await this.subscriptionRepo.findByTenantId(tenantId);

    // Lazy period check: if period has expired, handle renewal or scheduled downgrade
    if (subscription && subscription.status === SubscriptionStatus.ACTIVE) {
      const now = new Date();
      if (now >= subscription.currentPeriodEnd) {
        subscription = await this.handlePeriodExpiry(subscription);
      }
    }

    const plan = subscription?.status === SubscriptionStatus.ACTIVE ? subscription.plan : PlanTier.FREE;
    const limits = PLAN_LIMITS[plan];
    return { subscription, plan, limits };
  }

  private async handlePeriodExpiry(subscription: Subscription): Promise<Subscription> {
    const now = new Date();
    const newPeriodStart = now;
    const newPeriodEnd = new Date(now);
    newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

    if (subscription.scheduledPlan !== null) {
      // Apply scheduled downgrade
      const newPlan = subscription.scheduledPlan;
      const limits = PLAN_LIMITS[newPlan];

      const updated = await this.subscriptionRepo.update(subscription.id, {
        plan: newPlan,
        scheduledPlan: null,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
      });

      await this.billingRecordRepo.create({
        tenantId: subscription.tenantId,
        eventType: BillingEventType.PLAN_CHANGED,
        plan: newPlan,
        amountCents: limits.priceMonthly,
        description: `Scheduled downgrade to ${newPlan} applied`,
      });

      if (limits.priceMonthly > 0) {
        await this.billingRecordRepo.create({
          tenantId: subscription.tenantId,
          eventType: BillingEventType.PAYMENT_SUCCESS,
          plan: newPlan,
          amountCents: limits.priceMonthly,
          description: `Payment for ${newPlan} plan — $${(limits.priceMonthly / 100).toFixed(2)}/mo`,
        });
      }

      await this.enforceLimits.execute(subscription.tenantId);

      return updated!;
    } else {
      // Auto-renew current plan
      const limits = PLAN_LIMITS[subscription.plan];

      const updated = await this.subscriptionRepo.update(subscription.id, {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
      });

      if (limits.priceMonthly > 0) {
        await this.billingRecordRepo.create({
          tenantId: subscription.tenantId,
          eventType: BillingEventType.PAYMENT_SUCCESS,
          plan: subscription.plan,
          amountCents: limits.priceMonthly,
          description: `Renewal payment for ${subscription.plan} plan — $${(limits.priceMonthly / 100).toFixed(2)}/mo`,
        });
      }

      return updated!;
    }
  }
}
