import { WebhookDelivery, WebhookDeliveryStatus } from '../entities/webhook-delivery.entity.js';
import { PaginatedResult } from './conversation.repository.js';

export interface WebhookDeliveryRepository {
  create(
    data: Omit<
      WebhookDelivery,
      'id' | 'status' | 'attempts' | 'responseStatus' | 'responseBody' | 'lastError' | 'lastAttemptAt' | 'nextRetryAt' | 'createdAt'
    >,
  ): Promise<WebhookDelivery>;
  findById(id: string): Promise<WebhookDelivery | null>;
  findByEndpointId(endpointId: string, page: number, limit: number): Promise<PaginatedResult<WebhookDelivery>>;
  update(
    id: string,
    data: Partial<
      Pick<
        WebhookDelivery,
        'status' | 'attempts' | 'responseStatus' | 'responseBody' | 'lastError' | 'lastAttemptAt' | 'nextRetryAt'
      >
    >,
  ): Promise<WebhookDelivery | null>;
  /** Borra las entregas de un endpoint (al eliminar el endpoint). */
  deleteByEndpointId(endpointId: string): Promise<void>;
}

export { WebhookDeliveryStatus };
