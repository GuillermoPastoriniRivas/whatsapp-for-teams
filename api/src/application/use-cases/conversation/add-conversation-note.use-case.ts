import { ConversationNote } from '../../../domain/entities/conversation-note.entity.js';
import { ConversationNoteRepository } from '../../../domain/repositories/conversation-note.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';

export interface AddConversationNoteInput {
  conversationId: string;
  agentId: string;
  tenantId: string;
  body: string;
}

export class AddConversationNoteUseCase {
  constructor(
    private readonly noteRepo: ConversationNoteRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRepo: AgentRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: AddConversationNoteInput): Promise<Result<ConversationNote, ConversationNotFoundError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    const agent = await this.agentRepo.findById(input.agentId);
    const authorName = agent?.name ?? 'Unknown';

    const note = await this.noteRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      authorId: input.agentId,
      authorName,
      body: input.body,
    });

    const event = await this.eventRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      type: ConversationEventType.NOTE_ADDED,
      performedBy: input.agentId,
      data: { agentName: authorName, bodyPreview: input.body.substring(0, 80) },
    });
    this.gateway.emitToConversation(input.conversationId, 'conversation.event', event);

    this.gateway.emitToConversation(input.conversationId, 'note.new', note);

    return ok(note);
  }
}
