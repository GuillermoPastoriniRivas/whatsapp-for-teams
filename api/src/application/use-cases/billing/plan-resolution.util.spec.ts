import { effectivePlan, effectiveLimits, PAST_DUE_GRACE_DAYS } from './plan-resolution.util.js';
import { Subscription } from '../../../domain/entities/subscription.entity.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { PaymentProvider } from '../../../domain/enums/payment-provider.enum.js';

const PERIOD_END = new Date('2026-08-01T00:00:00Z');

function sub(status: SubscriptionStatus, plan = PlanTier.BUSINESS): Subscription {
  return new Subscription(
    'sub1',
    'tenant1',
    plan,
    status,
    new Date('2026-07-01T00:00:00Z'),
    PERIOD_END,
    new Date('2026-07-01T00:00:00Z'),
    null,
    null,
    PaymentProvider.LEMON_SQUEEZY,
  );
}

const daysAfterPeriodEnd = (days: number) =>
  new Date(PERIOD_END.getTime() + days * 24 * 60 * 60 * 1000);

describe('effectivePlan', () => {
  it('sin suscripción es FREE', () => {
    expect(effectivePlan(null)).toBe(PlanTier.FREE);
    expect(effectivePlan(undefined)).toBe(PlanTier.FREE);
  });

  it('activa devuelve el plan contratado', () => {
    expect(effectivePlan(sub(SubscriptionStatus.ACTIVE))).toBe(PlanTier.BUSINESS);
  });

  it('cancelada y vencida caen a FREE', () => {
    expect(effectivePlan(sub(SubscriptionStatus.CANCELED))).toBe(PlanTier.FREE);
    expect(effectivePlan(sub(SubscriptionStatus.EXPIRED))).toBe(PlanTier.FREE);
  });

  describe('past_due', () => {
    it('mantiene el plan durante la gracia: el webhook de renovación tarda', () => {
      expect(effectivePlan(sub(SubscriptionStatus.PAST_DUE), daysAfterPeriodEnd(0.1))).toBe(
        PlanTier.BUSINESS,
      );
      expect(
        effectivePlan(sub(SubscriptionStatus.PAST_DUE), daysAfterPeriodEnd(PAST_DUE_GRACE_DAYS - 0.5)),
      ).toBe(PlanTier.BUSINESS);
    });

    it('cae a FREE una vez pasada la gracia', () => {
      expect(
        effectivePlan(sub(SubscriptionStatus.PAST_DUE), daysAfterPeriodEnd(PAST_DUE_GRACE_DAYS + 0.5)),
      ).toBe(PlanTier.FREE);
    });
  });
});

describe('effectiveLimits', () => {
  it('Business incluye biblioteca, media en campañas y retención infinita', () => {
    const limits = effectiveLimits(sub(SubscriptionStatus.ACTIVE));
    expect(limits.mediaLibrary).toBe(true);
    expect(limits.campaignMedia).toBe(true);
    expect(limits.mediaRetentionDays).toBe(-1);
    expect(limits.storageBytes).toBeGreaterThan(0);
  });

  it('Free no tiene biblioteca ni media en campañas', () => {
    const limits = effectiveLimits(null);
    expect(limits.mediaLibrary).toBe(false);
    expect(limits.campaignMedia).toBe(false);
    expect(limits.storageBytes).toBe(0);
  });

  it('una Business cancelada opera con límites de Free', () => {
    expect(effectiveLimits(sub(SubscriptionStatus.CANCELED)).mediaLibrary).toBe(false);
  });
});
