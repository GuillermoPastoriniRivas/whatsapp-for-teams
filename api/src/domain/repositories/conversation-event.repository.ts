import { ConversationEvent } from '../entities/conversation-event.entity.js';

export interface ConversationEventRepository {
  create(event: Omit<ConversationEvent, 'id' | 'createdAt'>): Promise<ConversationEvent>;
  findByConversationId(conversationId: string): Promise<ConversationEvent[]>;
}
