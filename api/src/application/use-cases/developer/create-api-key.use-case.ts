import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FeatureNotInPlanError } from '../../../domain/errors/domain-errors.js';
import { generateApiKey, hashApiKey, apiKeyPrefix, toApiKeyView, ApiKeyView } from './developer-credentials.util.js';
import { resolvePlanFeatures } from './plan-features.util.js';

const MAX_ACTIVE_KEYS = 10;

export interface CreateApiKeyInput {
  tenantId: string;
  name: string;
  createdBy: string | null;
}

export interface CreateApiKeyOutput {
  apiKey: ApiKeyView;
  /** La clave completa; se muestra UNA sola vez y no se puede recuperar. */
  plainKey: string;
}

export class CreateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(input: CreateApiKeyInput): Promise<Result<CreateApiKeyOutput, DomainError>> {
    const { limits } = await resolvePlanFeatures(this.subscriptionRepo, input.tenantId);
    if (!limits.apiAccess) return err(new FeatureNotInPlanError('API access'));

    const activeCount = await this.apiKeyRepo.countActiveByTenantId(input.tenantId);
    if (activeCount >= MAX_ACTIVE_KEYS) {
      return err(new DomainError('API_KEY_LIMIT_REACHED', `You can have at most ${MAX_ACTIVE_KEYS} active API keys.`));
    }

    const plainKey = generateApiKey();
    const apiKey = await this.apiKeyRepo.create({
      tenantId: input.tenantId,
      name: input.name.trim(),
      prefix: apiKeyPrefix(plainKey),
      keyHash: hashApiKey(plainKey),
      createdBy: input.createdBy,
    });

    return ok({ apiKey: toApiKeyView(apiKey), plainKey });
  }
}
