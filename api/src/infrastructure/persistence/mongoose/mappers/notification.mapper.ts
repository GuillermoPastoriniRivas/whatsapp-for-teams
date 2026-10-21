import { Notification } from '../../../../domain/entities/notification.entity.js';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum.js';
import { NotificationDocument } from '../schemas/notification.schema.js';

export class NotificationMapper {
  static toDomain(doc: NotificationDocument): Notification {
    return new Notification(
      doc.publicId,
      doc.tenantId.toHexString(),
      doc.phoneNumberId ? doc.phoneNumberId.toHexString() : null,
      doc.contactId ? doc.contactId.toHexString() : null,
      doc.conversationId ? doc.conversationId.toHexString() : null,
      doc.messageId ? doc.messageId.toHexString() : null,
      doc.waMessageId ?? null,
      doc.to ?? null,
      doc.templateId ? doc.templateId.toHexString() : null,
      doc.templateName ?? null,
      doc.variables ?? {},
      doc.status as NotificationStatus,
      doc.sendAt ?? null,
      doc.queuedAt ?? null,
      doc.sentAt ?? null,
      doc.deliveredAt ?? null,
      doc.readAt ?? null,
      doc.failedAt ?? null,
      doc.failureCode ?? null,
      doc.failureReason ?? null,
      doc.metadata ?? {},
      doc.idempotencyKey ?? null,
      doc.requestHash ?? null,
      doc.sandbox === true,
      doc.createdByAgentId ? doc.createdByAgentId.toHexString() : null,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
