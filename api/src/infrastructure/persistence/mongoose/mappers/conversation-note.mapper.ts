import { ConversationNote } from '../../../../domain/entities/conversation-note.entity.js';
import { ConversationNoteDocument } from '../schemas/conversation-note.schema.js';

export class ConversationNoteMapper {
  static toDomain(doc: ConversationNoteDocument): ConversationNote {
    return new ConversationNote(
      doc._id.toHexString(),
      doc.conversationId.toHexString(),
      doc.tenantId.toHexString(),
      doc.authorId,
      doc.authorName,
      doc.body,
      doc.createdAt,
    );
  }
}
