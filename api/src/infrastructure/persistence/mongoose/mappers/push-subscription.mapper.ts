import { PushSubscription } from '../../../../domain/entities/push-subscription.entity.js';
import { PushSubscriptionDocument } from '../schemas/push-subscription.schema.js';

export class PushSubscriptionMapper {
  static toDomain(doc: PushSubscriptionDocument): PushSubscription {
    return new PushSubscription(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.agentId.toHexString(),
      doc.endpoint,
      { p256dh: doc.keys.p256dh, auth: doc.keys.auth },
      doc.userAgent ?? null,
      doc.createdAt,
    );
  }
}
