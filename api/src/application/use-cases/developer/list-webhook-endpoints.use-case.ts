import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { toWebhookEndpointView, WebhookEndpointView } from './developer-credentials.util.js';

export class ListWebhookEndpointsUseCase {
  constructor(private readonly endpointRepo: WebhookEndpointRepository) {}

  async execute(tenantId: string): Promise<WebhookEndpointView[]> {
    const endpoints = await this.endpointRepo.findByTenantId(tenantId);
    return endpoints.map(toWebhookEndpointView);
  }
}
