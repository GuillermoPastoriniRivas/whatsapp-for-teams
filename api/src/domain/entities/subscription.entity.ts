import { PlanTier } from '../enums/plan-tier.enum.js';
import { SubscriptionStatus } from '../enums/subscription-status.enum.js';

export class Subscription {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly plan: PlanTier,
    public readonly status: SubscriptionStatus,
    public readonly currentPeriodStart: Date,
    public readonly currentPeriodEnd: Date,
    public readonly createdAt: Date,
    public readonly canceledAt: Date | null,
    public readonly scheduledPlan: PlanTier | null = null,
  ) {}
}
