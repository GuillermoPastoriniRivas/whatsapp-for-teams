import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ApiKeyNotFoundError } from '../../../domain/errors/domain-errors.js';
import { toApiKeyView, ApiKeyView } from './developer-credentials.util.js';

export class RevokeApiKeyUseCase {
  constructor(private readonly apiKeyRepo: ApiKeyRepository) {}

  async execute(tenantId: string, apiKeyId: string): Promise<Result<ApiKeyView, DomainError>> {
    const key = await this.apiKeyRepo.findById(apiKeyId);
    if (!key || key.tenantId !== tenantId) return err(new ApiKeyNotFoundError());

    const revoked = await this.apiKeyRepo.revoke(apiKeyId, new Date());
    return ok(toApiKeyView(revoked ?? key));
  }
}
