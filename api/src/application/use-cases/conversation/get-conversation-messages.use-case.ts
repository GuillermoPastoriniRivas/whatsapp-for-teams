import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';
import { MessageMediaEnricher, MessageWithMedia } from '../media/message-media.enricher.js';

export interface GetConversationMessagesInput {
  conversationId: string;
  page: number;
  limit: number;
}

export class GetConversationMessagesUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly mediaEnricher: MessageMediaEnricher,
  ) {}

  async execute(
    input: GetConversationMessagesInput,
  ): Promise<Result<PaginatedResult<MessageWithMedia>, ConversationNotFoundError>> {
    const conv = await this.conversationRepo.findById(input.conversationId);
    if (!conv) return err(new ConversationNotFoundError());

    const result = await this.messageRepo.findByConversationId(
      input.conversationId,
      input.page,
      input.limit,
    );

    // Las URLs del archivo se firman por request: son de corta vida a propósito.
    return ok({ ...result, data: await this.mediaEnricher.many(result.data) });
  }
}
