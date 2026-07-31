import { WebhookDelivery, WebhookDeliveryStatus } from '../../../../domain/entities/webhook-delivery.entity.js';
import { DeveloperEventType } from '../../../../domain/enums/developer-event-type.enum.js';
import { WebhookDeliveryDocument } from '../schemas/webhook-delivery.schema.js';

export class WebhookDeliveryMapper {
  static toDomain(doc: WebhookDeliveryDocument): WebhookDelivery {
    return new WebhookDelivery(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.endpointId.toHexString(),
      doc.eventId,
      doc.eventType as DeveloperEventType,
      doc.payload,
      doc.status as WebhookDeliveryStatus,
      doc.attempts,
      doc.responseStatus ?? null,
      doc.responseBody ?? null,
      doc.lastError ?? null,
      doc.lastAttemptAt ?? null,
      doc.nextRetryAt ?? null,
      doc.createdAt,
    );
  }
}
