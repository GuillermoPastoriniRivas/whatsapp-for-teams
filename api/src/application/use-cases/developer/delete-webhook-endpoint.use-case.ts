import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { WebhookDeliveryRepository } from '../../../domain/repositories/webhook-delivery.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, WebhookEndpointNotFoundError } from '../../../domain/errors/domain-errors.js';

export class DeleteWebhookEndpointUseCase {
  constructor(
    private readonly endpointRepo: WebhookEndpointRepository,
    private readonly deliveryRepo: WebhookDeliveryRepository,
  ) {}

  async execute(tenantId: string, endpointId: string): Promise<Result<{ deleted: true }, DomainError>> {
    const endpoint = await this.endpointRepo.findById(endpointId);
    if (!endpoint || endpoint.tenantId !== tenantId) {
      return err(new WebhookEndpointNotFoundError());
    }

    await this.endpointRepo.delete(endpointId);
    await this.deliveryRepo.deleteByEndpointId(endpointId);
    return ok({ deleted: true });
  }
}
