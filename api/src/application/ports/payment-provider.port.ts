import { PlanTier } from '../../domain/enums/plan-tier.enum.js';

export interface CreateCheckoutParams {
  tenantId: string;
  customerEmail: string;
  plan: PlanTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
}

export type WebhookEventType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_renewed'
  | 'payment_success'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'subscription_expired';

export interface WebhookEvent {
  type: WebhookEventType;
  externalSubscriptionId: string;
  externalCustomerId: string;
  tenantId: string | null;
  plan: PlanTier | null;
  status: string;
  currentPeriodEnd: Date | null;
}

export interface PaymentProviderPort {
  createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
  getCustomerPortalUrl(externalCustomerId: string): Promise<string | null>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhookEvent(payload: unknown): WebhookEvent;
}
