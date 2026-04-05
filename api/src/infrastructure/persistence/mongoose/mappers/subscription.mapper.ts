import { Subscription } from '../../../../domain/entities/subscription.entity.js';
import { PlanTier } from '../../../../domain/enums/plan-tier.enum.js';
import { PaymentProvider } from '../../../../domain/enums/payment-provider.enum.js';
import { SubscriptionStatus } from '../../../../domain/enums/subscription-status.enum.js';
import { SubscriptionDocument } from '../schemas/subscription.schema.js';

export class SubscriptionMapper {
  static toDomain(doc: SubscriptionDocument): Subscription {
    return new Subscription(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.plan as PlanTier,
      doc.status as SubscriptionStatus,
      doc.currentPeriodStart,
      doc.currentPeriodEnd,
      doc.createdAt,
      doc.canceledAt,
      (doc.scheduledPlan as PlanTier) ?? null,
      (doc.paymentProvider as PaymentProvider) ?? PaymentProvider.NONE,
      doc.externalCustomerId ?? null,
      doc.externalSubscriptionId ?? null,
    );
  }
}
