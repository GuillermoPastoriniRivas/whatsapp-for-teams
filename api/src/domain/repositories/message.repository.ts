import { Message } from '../entities/message.entity.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export interface MessageRepository {
  upsertByWaMessageId(message: Omit<Message, 'id'>): Promise<Message>;
  findByConversationId(conversationId: string, page: number, limit: number): Promise<PaginatedResult<Message>>;
  updateStatusByWaMessageId(waMessageId: string, waStatus: MessageWaStatus): Promise<Message | null>;
}
