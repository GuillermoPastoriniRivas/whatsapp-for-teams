import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository.js';
import { toApiKeyView, ApiKeyView } from './developer-credentials.util.js';

export class ListApiKeysUseCase {
  constructor(private readonly apiKeyRepo: ApiKeyRepository) {}

  async execute(tenantId: string): Promise<ApiKeyView[]> {
    const keys = await this.apiKeyRepo.findByTenantId(tenantId);
    return keys.map(toApiKeyView);
  }
}
