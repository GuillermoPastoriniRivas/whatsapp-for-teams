import { BillingEventType } from '../enums/billing-event-type.enum.js';
import { PlanTier } from '../enums/plan-tier.enum.js';

export class BillingRecord {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly eventType: BillingEventType,
    public readonly plan: PlanTier,
    public readonly amountCents: number,
    public readonly description: string,
    public readonly createdAt: Date,
  ) {}
}
