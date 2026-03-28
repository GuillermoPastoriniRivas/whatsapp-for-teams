import { ConversationEvent } from '../../../domain/entities/conversation-event.entity.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';

export class GetConversationEventsUseCase {
  constructor(private readonly eventRepo: ConversationEventRepository) {}

  async execute(conversationId: string): Promise<ConversationEvent[]> {
    return this.eventRepo.findByConversationId(conversationId);
  }
}
