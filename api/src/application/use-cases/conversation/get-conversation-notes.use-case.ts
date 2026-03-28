import { ConversationNote } from '../../../domain/entities/conversation-note.entity.js';
import { ConversationNoteRepository } from '../../../domain/repositories/conversation-note.repository.js';

export class GetConversationNotesUseCase {
  constructor(private readonly noteRepo: ConversationNoteRepository) {}

  async execute(conversationId: string): Promise<ConversationNote[]> {
    return this.noteRepo.findByConversationId(conversationId);
  }
}
