import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, InvalidApiKeyError, FeatureNotInPlanError } from '../../../domain/errors/domain-errors.js';
import { hashApiKey } from './developer-credentials.util.js';
import { resolvePlanFeatures } from './plan-features.util.js';
import type { ApiScope } from '../../../domain/value-objects/api-scopes.js';

export interface ApiKeyPrincipal {
  tenantId: string;
  apiKeyId: string;
  keyName: string;
  scopes: ApiScope[];
  /** Quién creó la clave: es a quien se le atribuye lo que la clave construya. */
  createdByAgentId: string | null;
}

/** Ventana para no escribir lastUsedAt en cada request. */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

export class AuthenticateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(plainKey: string): Promise<Result<ApiKeyPrincipal, DomainError>> {
    if (!plainKey || !plainKey.startsWith('ak_')) return err(new InvalidApiKeyError());

    const key = await this.apiKeyRepo.findActiveByKeyHash(hashApiKey(plainKey));
    if (!key) return err(new InvalidApiKeyError());

    // El acceso por API es una feature de plan: si el tenant bajó de plan,
    // sus claves dejan de funcionar hasta que vuelva a un plan con API.
    const { limits } = await resolvePlanFeatures(this.subscriptionRepo, key.tenantId);
    if (!limits.apiAccess) return err(new FeatureNotInPlanError('API access'));

    const now = new Date();
    if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
      void this.apiKeyRepo.updateLastUsed(key.id, now).catch(() => {});
    }

    return ok({
      tenantId: key.tenantId,
      apiKeyId: key.id,
      keyName: key.name,
      scopes: key.scopes,
      createdByAgentId: key.createdBy,
    });
  }
}
