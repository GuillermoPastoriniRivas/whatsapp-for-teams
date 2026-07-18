import { CampaignRecipient } from '../../../../domain/entities/campaign-recipient.entity.js';
import { CampaignRecipientStatus } from '../../../../domain/enums/campaign-recipient-status.enum.js';
import { CampaignRecipientDocument } from '../schemas/campaign-recipient.schema.js';

export class CampaignRecipientMapper {
  static toDomain(doc: CampaignRecipientDocument): CampaignRecipient {
    return new CampaignRecipient(
      doc._id.toHexString(),
      doc.campaignId.toHexString(),
      doc.tenantId.toHexString(),
      doc.contactId.toHexString(),
      doc.waId,
      doc.phone,
      doc.resolvedVariables ?? {},
      doc.status as CampaignRecipientStatus,
      doc.attemptCount ?? 0,
      doc.nextAttemptAt ?? null,
      doc.waMessageId ?? null,
      doc.messageId?.toHexString() ?? null,
      doc.conversationId?.toHexString() ?? null,
      doc.failureCode ?? null,
      doc.failureReason ?? null,
      doc.sentAt ?? null,
      doc.deliveredAt ?? null,
      doc.readAt ?? null,
      doc.repliedAt ?? null,
      doc.replyWindowExpiresAt ?? null,
      doc.createdAt,
    );
  }
}
