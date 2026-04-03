import { ConversationLabel } from '../../../../domain/entities/conversation-label.entity.js';
import { ConversationLabelDocument } from '../schemas/conversation-label.schema.js';

export class ConversationLabelMapper {
  static toDomain(doc: ConversationLabelDocument): ConversationLabel {
    return new ConversationLabel(
      doc._id.toHexString(),
      doc.conversationId.toHexString(),
      doc.tenantId.toHexString(),
      doc.labelId.toHexString(),
      doc.assignedBy,
      doc.createdAt,
    );
  }
}
