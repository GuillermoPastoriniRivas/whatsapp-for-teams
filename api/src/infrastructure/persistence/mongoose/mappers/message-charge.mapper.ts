import type { ChargeSenderKind, MessageCharge } from '../../../../domain/entities/message-charge.entity.js';
import type { EstimatedCategory } from '../../../../domain/value-objects/outbound-billing.js';
import { MessageChargeDocument } from '../schemas/message-charge.schema.js';

export class MessageChargeMapper {
  static toDomain(doc: MessageChargeDocument): MessageCharge {
    return {
      id: doc._id.toHexString(),
      waMessageId: doc.waMessageId,
      tenantId: doc.tenantId.toHexString(),
      phoneNumberId: doc.phoneNumberId.toHexString(),
      conversationId: doc.conversationId?.toHexString() ?? null,
      messageId: doc.messageId?.toHexString() ?? null,
      contactId: doc.contactId?.toHexString() ?? null,
      destinationCountry: doc.destinationCountry ?? null,
      destinationPrefix: doc.destinationPrefix ?? null,
      sentAt: doc.sentAt,
      deliveredAt: doc.deliveredAt ?? null,
      failedAt: doc.failedAt ?? null,
      waErrorCode: doc.waErrorCode ?? null,
      senderKind: doc.senderKind as ChargeSenderKind,
      campaignId: doc.campaignId?.toHexString() ?? null,
      adSourceId: doc.adSourceId ?? null,
      flowId: doc.flowId?.toHexString() ?? null,
      isTemplate: doc.isTemplate,
      templateId: doc.templateId?.toHexString() ?? null,
      templateCategory: (doc.templateCategory as EstimatedCategory | null) ?? null,
      marketingLite: doc.marketingLite,
      estimatedCategory: doc.estimatedCategory as EstimatedCategory,
      freeEntryPoint: doc.freeEntryPoint,
      windowOpen: doc.windowOpen,
      meta: doc.meta ?? null,
      rate: doc.rate ?? null,
      source: doc.source,
    };
  }
}
