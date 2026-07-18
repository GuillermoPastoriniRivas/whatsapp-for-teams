import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { BillingRecordRepository } from '../../../domain/repositories/billing-record.repository.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { PaymentProvider } from '../../../domain/enums/payment-provider.enum.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { BillingEventType } from '../../../domain/enums/billing-event-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { EnforcePlanLimitsUseCase } from './enforce-plan-limits.use-case.js';

export interface SubscribeInput {
  tenantId: string;
  plan: PlanTier;
}

export class SubscribeUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly billingRecordRepo: BillingRecordRepository,
    private readonly enforceLimits: EnforcePlanLimitsUseCase,
  ) {}

  async execute(input: SubscribeInput): Promise<Result<Subscription, DomainError>> {
    // Free plan selection: any tier is activated immediately, no payment.
    const existing = await this.subscriptionRepo.findByTenantId(input.tenantId);
    if (existing && existing.status === SubscriptionStatus.ACTIVE) {
      return err(new DomainError('SUBSCRIPTION_EXISTS', 'An active subscription already exists. Use change plan instead.'));
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    let subscription: Subscription;

    if (existing) {
      subscription = (await this.subscriptionRepo.update(existing.id, {
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
      }))!;
    } else {
      subscription = await this.subscriptionRepo.create({
        tenantId: input.tenantId,
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        scheduledPlan: null,
        paymentProvider: PaymentProvider.NONE,
        externalCustomerId: null,
        externalSubscriptionId: null,
      });
    }

    await this.billingRecordRepo.create({
      tenantId: input.tenantId,
      eventType: BillingEventType.SUBSCRIPTION_CREATED,
      plan: input.plan,
      amountCents: 0,
      description: `Subscribed to ${input.plan} plan`,
    });

    await this.enforceLimits.execute(input.tenantId);

    return ok(subscription);
  }
}
