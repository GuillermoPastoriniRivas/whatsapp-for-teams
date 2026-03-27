import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';

export class GetConversationDetailUseCase {
  constructor(private readonly conversationRepo: ConversationRepository) {}

  async execute(conversationId: string): Promise<Result<Conversation, ConversationNotFoundError>> {
    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) return err(new ConversationNotFoundError());
    return ok(conv);
  }
}
