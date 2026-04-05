import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { BillingRecordRepository } from '../../../domain/repositories/billing-record.repository.js';
import { PaymentProvider } from '../../../domain/enums/payment-provider.enum.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { BillingEventType } from '../../../domain/enums/billing-event-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { SubscriptionNotFoundError } from '../../../domain/errors/domain-errors.js';
import { EnforcePlanLimitsUseCase } from './enforce-plan-limits.use-case.js';
import { PaymentProviderPort } from '../../ports/payment-provider.port.js';

export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly billingRecordRepo: BillingRecordRepository,
    private readonly enforceLimits: EnforcePlanLimitsUseCase,
    private readonly paymentProvider?: PaymentProviderPort,
  ) {}

  async execute(tenantId: string): Promise<Result<Subscription, SubscriptionNotFoundError>> {
    const existing = await this.subscriptionRepo.findByTenantId(tenantId);
    if (!existing) return err(new SubscriptionNotFoundError());

    // Cancel external subscription if one exists
    if (existing.externalSubscriptionId && existing.paymentProvider !== PaymentProvider.NONE && this.paymentProvider) {
      try {
        await this.paymentProvider.cancelSubscription(existing.externalSubscriptionId);
      } catch {
        // Log but don't block cancellation — webhook will reconcile
      }
    }

    const updated = await this.subscriptionRepo.update(existing.id, {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
    });

    await this.billingRecordRepo.create({
      tenantId,
      eventType: BillingEventType.SUBSCRIPTION_CANCELED,
      plan: existing.plan,
      amountCents: 0,
      description: `Canceled ${existing.plan} plan subscription`,
    });

    await this.enforceLimits.execute(tenantId);

    return ok(updated!);
  }
}
