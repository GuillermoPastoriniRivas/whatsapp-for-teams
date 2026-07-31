import { WebhookEndpoint } from '../../../../domain/entities/webhook-endpoint.entity.js';
import { DeveloperEventType } from '../../../../domain/enums/developer-event-type.enum.js';
import { WebhookEndpointDocument } from '../schemas/webhook-endpoint.schema.js';

export class WebhookEndpointMapper {
  static toDomain(doc: WebhookEndpointDocument): WebhookEndpoint {
    return new WebhookEndpoint(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.url,
      doc.description ?? null,
      doc.secret,
      doc.events as DeveloperEventType[],
      doc.active,
      doc.createdAt,
    );
  }
}
