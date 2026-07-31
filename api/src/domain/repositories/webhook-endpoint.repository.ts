import { WebhookEndpoint } from '../entities/webhook-endpoint.entity.js';
import { DeveloperEventType } from '../enums/developer-event-type.enum.js';

export interface WebhookEndpointRepository {
  create(data: Omit<WebhookEndpoint, 'id' | 'createdAt'>): Promise<WebhookEndpoint>;
  findById(id: string): Promise<WebhookEndpoint | null>;
  findByTenantId(tenantId: string): Promise<WebhookEndpoint[]>;
  findActiveByTenantAndEvent(tenantId: string, event: DeveloperEventType): Promise<WebhookEndpoint[]>;
  update(
    id: string,
    data: Partial<Pick<WebhookEndpoint, 'url' | 'description' | 'events' | 'active' | 'secret'>>,
  ): Promise<WebhookEndpoint | null>;
  delete(id: string): Promise<void>;
  countByTenantId(tenantId: string): Promise<number>;
}
