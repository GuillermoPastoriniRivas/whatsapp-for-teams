import { ConversationNote } from '../entities/conversation-note.entity.js';

export interface ConversationNoteRepository {
  create(note: Omit<ConversationNote, 'id' | 'createdAt'>): Promise<ConversationNote>;
  findByConversationId(conversationId: string): Promise<ConversationNote[]>;
}
