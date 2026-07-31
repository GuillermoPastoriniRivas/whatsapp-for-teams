import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository.js';
import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { resolvePlanFeatures } from './plan-features.util.js';

export interface DeveloperOverview {
  plan: PlanTier;
  apiAccess: boolean;
  webhooks: boolean;
  activeApiKeys: number;
  webhookEndpoints: number;
}

/** Estado de la plataforma de desarrolladores para el tenant (gating de la UI). */
export class GetDeveloperOverviewUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly endpointRepo: WebhookEndpointRepository,
  ) {}

  async execute(tenantId: string): Promise<DeveloperOverview> {
    const [{ plan, limits }, activeApiKeys, webhookEndpoints] = await Promise.all([
      resolvePlanFeatures(this.subscriptionRepo, tenantId),
      this.apiKeyRepo.countActiveByTenantId(tenantId),
      this.endpointRepo.countByTenantId(tenantId),
    ]);

    return {
      plan,
      apiAccess: limits.apiAccess,
      webhooks: limits.webhooks,
      activeApiKeys,
      webhookEndpoints,
    };
  }
}
