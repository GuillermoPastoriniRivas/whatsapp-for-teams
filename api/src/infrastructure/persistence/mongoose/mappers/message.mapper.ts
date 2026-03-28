import { Message } from '../../../../domain/entities/message.entity.js';
import { MessageDirection } from '../../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';
import { MessageDocument } from '../schemas/message.schema.js';

export class MessageMapper {
  static toDomain(doc: MessageDocument): Message {
    return new Message(
      doc._id.toHexString(),
      doc.conversationId.toHexString(),
      doc.direction as MessageDirection,
      doc.messageType as MessageType,
      doc.body,
      doc.mediaUrl,
      doc.mimeType,
      doc.waMessageId,
      doc.waStatus as MessageWaStatus,
      doc.timestamp,
      doc.senderAgentId ?? null,
      doc.senderAgentName ?? null,
    );
  }
}
