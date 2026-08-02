import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { PLAN_LIMITS, PlanLimits } from '../../../domain/constants/plan-limits.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';

/**
 * Margen para que un pago en reintento no baje al cliente a FREE de golpe.
 *
 * El webhook de renovación no llega en el mismo instante en que vence el
 * período: entre que el proveedor cobra y nos avisa pueden pasar horas. Sin
 * esta ventana, un cliente que paga se queda sin números, sin bots y sin
 * biblioteca por un problema que es nuestro, no suyo.
 */
export const PAST_DUE_GRACE_DAYS = 3;

/**
 * Plan efectivo del tenant. **Única fuente de verdad**: si esta regla se
 * duplica a mano en cada use-case, tarde o temprano una copia se olvida de
 * mirar el estado y muestra Business con límites de Free.
 */
export function effectivePlan(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): PlanTier {
  if (!subscription) return PlanTier.FREE;

  if (subscription.status === SubscriptionStatus.ACTIVE) return subscription.plan;

  if (subscription.status === SubscriptionStatus.PAST_DUE) {
    const graceEnds = new Date(
      subscription.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    if (now < graceEnds) return subscription.plan;
  }

  return PlanTier.FREE;
}

export function effectiveLimits(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): PlanLimits {
  return PLAN_LIMITS[effectivePlan(subscription, now)];
}

export async function resolvePlanFeatures(
  subscriptionRepo: SubscriptionRepository,
  tenantId: string,
  now: Date = new Date(),
): Promise<{ plan: PlanTier; limits: PlanLimits; subscription: Subscription | null }> {
  const subscription = await subscriptionRepo.findByTenantId(tenantId);
  const plan = effectivePlan(subscription, now);
  return { plan, limits: PLAN_LIMITS[plan], subscription };
}
