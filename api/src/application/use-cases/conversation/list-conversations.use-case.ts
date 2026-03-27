import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { ConversationRepository, PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { ConversationFiltersInput } from '../../dtos/conversation/conversation-filters.dto.js';

export class ListConversationsUseCase {
  constructor(private readonly conversationRepo: ConversationRepository) {}

  async execute(filters: ConversationFiltersInput): Promise<PaginatedResult<Conversation>> {
    return this.conversationRepo.findByFilters(filters);
  }
}
