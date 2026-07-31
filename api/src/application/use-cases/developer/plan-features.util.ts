import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { PLAN_LIMITS, PlanLimits } from '../../../domain/constants/plan-limits.js';

/** Plan efectivo del tenant: el contratado si la suscripción está activa, FREE si no. */
export async function resolvePlanFeatures(
  subscriptionRepo: SubscriptionRepository,
  tenantId: string,
): Promise<{ plan: PlanTier; limits: PlanLimits }> {
  const sub = await subscriptionRepo.findByTenantId(tenantId);
  const plan = sub?.status === SubscriptionStatus.ACTIVE ? sub.plan : PlanTier.FREE;
  return { plan, limits: PLAN_LIMITS[plan] };
}
