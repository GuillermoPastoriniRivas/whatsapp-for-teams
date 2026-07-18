import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';
import { ConversationOrigin } from '../../../../domain/enums/conversation-origin.enum.js';
import { ConversationDocument } from '../schemas/conversation.schema.js';

export class ConversationMapper {
  static toDomain(doc: ConversationDocument): Conversation {
    return new Conversation(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.contactId.toHexString(),
      doc.agentId?.toHexString() ?? null,
      doc.status as ConversationStatus,
      doc.lastMessageAt,
      doc.lastInboundAt,
      doc.createdAt,
      doc.resolvedAt,
      doc.closedBy,
      doc.summary ?? null,
      doc.pendingAiSince ?? null,
      (doc.origin as ConversationOrigin) ?? ConversationOrigin.INBOUND,
      doc.hasReplied ?? true,
      doc.repliedAt ?? null,
    );
  }
}
