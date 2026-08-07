import { Message } from '../entities/message.entity.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';
import { MessageLocation } from '../value-objects/message-location.js';
import { PaginatedResult } from './conversation.repository.js';

export type UpsertMessageInput = Omit<
  Message,
  'id' | 'campaignId' | 'waErrorCode' | 'waErrorMessage' | 'interactiveReplyId' | 'contextWaMessageId' | 'interactivePayload' | 'mediaAssetId' | 'location' | 'senderKind'
> & {
  /** Quién lo escribió. Omitido = desconocido (mensajes previos a ago-2026). */
  senderKind?: import('../entities/message.entity.js').MessageSenderKind | null;
  campaignId?: string | null;
  interactiveReplyId?: string | null;
  contextWaMessageId?: string | null;
  interactivePayload?: Record<string, unknown> | null;
  mediaAssetId?: string | null;
  location?: MessageLocation | null;
};

export interface MessageRepository {
  upsertByWaMessageId(message: UpsertMessageInput): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  attachMediaAsset(messageId: string, mediaAssetId: string): Promise<Message | null>;
  findByConversationId(conversationId: string, page: number, limit: number): Promise<PaginatedResult<Message>>;
  updateStatusByWaMessageId(
    waMessageId: string,
    waStatus: MessageWaStatus,
    errorInfo?: { code: string; message: string },
  ): Promise<Message | null>;
}
