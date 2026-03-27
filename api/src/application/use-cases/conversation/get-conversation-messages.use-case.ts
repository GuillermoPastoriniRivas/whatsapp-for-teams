import { Message } from '../../../domain/entities/message.entity.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface GetConversationMessagesInput {
  conversationId: string;
  page: number;
  limit: number;
}

export class GetConversationMessagesUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly conversationRepo: ConversationRepository,
  ) {}

  async execute(input: GetConversationMessagesInput): Promise<Result<PaginatedResult<Message>, ConversationNotFoundError>> {
    const conv = await this.conversationRepo.findById(input.conversationId);
    if (!conv) return err(new ConversationNotFoundError());

    const result = await this.messageRepo.findByConversationId(
      input.conversationId,
      input.page,
      input.limit,
    );

    return ok(result);
  }
}
