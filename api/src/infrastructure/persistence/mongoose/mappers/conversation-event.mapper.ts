import { ConversationEvent } from '../../../../domain/entities/conversation-event.entity.js';
import { ConversationEventType } from '../../../../domain/enums/conversation-event-type.enum.js';
import { ConversationEventDocument } from '../schemas/conversation-event.schema.js';

export class ConversationEventMapper {
  static toDomain(doc: ConversationEventDocument): ConversationEvent {
    return new ConversationEvent(
      doc._id.toHexString(),
      doc.conversationId.toHexString(),
      doc.tenantId.toHexString(),
      doc.type as ConversationEventType,
      doc.performedBy,
      doc.data,
      doc.createdAt,
    );
  }
}
