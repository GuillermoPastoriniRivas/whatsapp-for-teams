import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, WebhookEndpointNotFoundError } from '../../../domain/errors/domain-errors.js';
import { generateWebhookSecret, toWebhookEndpointView, WebhookEndpointView } from './developer-credentials.util.js';

export class RotateWebhookSecretUseCase {
  constructor(private readonly endpointRepo: WebhookEndpointRepository) {}

  async execute(tenantId: string, endpointId: string): Promise<Result<WebhookEndpointView, DomainError>> {
    const endpoint = await this.endpointRepo.findById(endpointId);
    if (!endpoint || endpoint.tenantId !== tenantId) {
      return err(new WebhookEndpointNotFoundError());
    }

    const updated = await this.endpointRepo.update(endpointId, { secret: generateWebhookSecret() });
    return ok(toWebhookEndpointView(updated ?? endpoint));
  }
}
