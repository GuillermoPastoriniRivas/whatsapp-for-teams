import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { WebhookDeliveryRepository } from '../../../domain/repositories/webhook-delivery.repository.js';
import { WebhookDelivery } from '../../../domain/entities/webhook-delivery.entity.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, WebhookEndpointNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface ListWebhookDeliveriesInput {
  tenantId: string;
  endpointId: string;
  page: number;
  limit: number;
}

export class ListWebhookDeliveriesUseCase {
  constructor(
    private readonly endpointRepo: WebhookEndpointRepository,
    private readonly deliveryRepo: WebhookDeliveryRepository,
  ) {}

  async execute(input: ListWebhookDeliveriesInput): Promise<Result<PaginatedResult<WebhookDelivery>, DomainError>> {
    const endpoint = await this.endpointRepo.findById(input.endpointId);
    if (!endpoint || endpoint.tenantId !== input.tenantId) {
      return err(new WebhookEndpointNotFoundError());
    }

    const result = await this.deliveryRepo.findByEndpointId(input.endpointId, input.page, input.limit);
    return ok(result);
  }
}
