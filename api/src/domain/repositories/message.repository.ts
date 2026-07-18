import { Message } from '../entities/message.entity.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export type UpsertMessageInput = Omit<Message, 'id' | 'campaignId' | 'waErrorCode' | 'waErrorMessage'> & {
  campaignId?: string | null;
};

export interface MessageRepository {
  upsertByWaMessageId(message: UpsertMessageInput): Promise<Message>;
  findByConversationId(conversationId: string, page: number, limit: number): Promise<PaginatedResult<Message>>;
  updateStatusByWaMessageId(
    waMessageId: string,
    waStatus: MessageWaStatus,
    errorInfo?: { code: string; message: string },
  ): Promise<Message | null>;
}
