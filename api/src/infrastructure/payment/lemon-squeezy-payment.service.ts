import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { PaymentProviderPort, CreateCheckoutParams, CreateCheckoutResult, WebhookEvent, WebhookEventType } from '../../application/ports/payment-provider.port.js';
import { PlanTier } from '../../domain/enums/plan-tier.enum.js';

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1';

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { tenant_id?: string };
  };
  data: {
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      variant_id: number;
      status: string;
      renews_at: string | null;
      ends_at: string | null;
      urls: {
        update_payment_method?: string;
        customer_portal?: string;
      };
    };
  };
}

@Injectable()
export class LemonSqueezyPaymentService implements PaymentProviderPort {
  private readonly apiKey: string;
  private readonly storeId: string;
  private readonly webhookSecret: string;
  private readonly variantMap: Record<string, string>;
  private readonly reverseVariantMap: Record<string, PlanTier>;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('lemonSqueezy.apiKey', '');
    this.storeId = this.config.get<string>('lemonSqueezy.storeId', '');
    this.webhookSecret = this.config.get<string>('lemonSqueezy.webhookSecret', '');

    this.variantMap = {
      [PlanTier.PRO]: this.config.get<string>('lemonSqueezy.variants.pro', ''),
      [PlanTier.BUSINESS]: this.config.get<string>('lemonSqueezy.variants.business', ''),
      [PlanTier.AGENCIES]: this.config.get<string>('lemonSqueezy.variants.agencies', ''),
    };

    this.reverseVariantMap = {};
    for (const [plan, variantId] of Object.entries(this.variantMap)) {
      if (variantId) this.reverseVariantMap[variantId] = plan as PlanTier;
    }
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
    const variantId = this.variantMap[params.plan];
    if (!variantId) {
      throw new Error(`No Lemon Squeezy variant configured for plan: ${params.plan}`);
    }

    const payload = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: params.customerEmail,
            custom: { tenant_id: params.tenantId },
          },
          product_options: {
            redirect_url: params.successUrl,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: this.storeId } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    };

    const response = await fetch(`${LS_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Lemon Squeezy checkout failed (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    const checkoutUrl = result.data?.attributes?.url;

    if (!checkoutUrl) {
      throw new Error('Lemon Squeezy response missing checkout URL');
    }

    return { checkoutUrl };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    const response = await fetch(`${LS_API_BASE}/subscriptions/${externalSubscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: externalSubscriptionId,
          attributes: { cancelled: true },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Lemon Squeezy cancel failed (${response.status}): ${errorBody}`);
    }
  }

  async getCustomerPortalUrl(externalCustomerId: string): Promise<string | null> {
    try {
      const response = await fetch(`${LS_API_BASE}/customers/${externalCustomerId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json',
        },
      });

      if (!response.ok) return null;

      const result = await response.json();
      return result.data?.attributes?.urls?.customer_portal ?? null;
    } catch {
      return null;
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = hmac.update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const p = payload as LemonSqueezyWebhookPayload;
    const eventName = p.meta.event_name;
    const attrs = p.data.attributes;

    const typeMap: Record<string, WebhookEventType> = {
      'subscription_created': 'subscription_created',
      'subscription_updated': 'subscription_updated',
      'subscription_payment_success': 'payment_success',
      'subscription_payment_failed': 'payment_failed',
      'subscription_expired': 'subscription_expired',
      'subscription_cancelled': 'subscription_canceled',
    };

    const periodEnd = attrs.renews_at ?? attrs.ends_at;

    return {
      type: typeMap[eventName] ?? 'subscription_updated',
      externalSubscriptionId: p.data.id,
      externalCustomerId: String(attrs.customer_id),
      tenantId: p.meta.custom_data?.tenant_id ?? null,
      plan: this.reverseVariantMap[String(attrs.variant_id)] ?? null,
      status: attrs.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    };
  }
}
