import { ConversationLabel } from '../entities/conversation-label.entity.js';

export interface ConversationLabelRepository {
  create(data: Omit<ConversationLabel, 'id' | 'createdAt'>): Promise<ConversationLabel>;
  delete(conversationId: string, labelId: string): Promise<void>;
  findByConversationId(conversationId: string): Promise<ConversationLabel[]>;
  findByConversationIds(conversationIds: string[]): Promise<ConversationLabel[]>;
  findByLabelId(labelId: string): Promise<ConversationLabel[]>;
  deleteByLabelId(labelId: string): Promise<void>;
}
