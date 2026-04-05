import { Subscription } from '../entities/subscription.entity.js';
import { PlanTier } from '../enums/plan-tier.enum.js';
import { SubscriptionStatus } from '../enums/subscription-status.enum.js';

export interface SubscriptionRepository {
  create(subscription: Omit<Subscription, 'id' | 'createdAt' | 'canceledAt'>): Promise<Subscription>;
  findByTenantId(tenantId: string): Promise<Subscription | null>;
  findByExternalSubscriptionId(externalSubscriptionId: string): Promise<Subscription | null>;
  update(id: string, data: Partial<Pick<Subscription, 'plan' | 'status' | 'currentPeriodStart' | 'currentPeriodEnd' | 'canceledAt' | 'scheduledPlan' | 'paymentProvider' | 'externalCustomerId' | 'externalSubscriptionId'>>): Promise<Subscription | null>;
}
