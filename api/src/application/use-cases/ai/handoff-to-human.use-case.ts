import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { ConversationNoteRepository } from '../../../domain/repositories/conversation-note.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';

export interface HandoffInput {
  conversationId: string;
  /** Nombre con el que se presentó el asistente; solo para la nota y el evento. */
  aiName: string;
  tenantId: string;
  reason: string;
  summary?: string;
}

export class HandoffToHumanUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly noteRepo: ConversationNoteRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly autoAssign: AutoAssignConversationUseCase,
  ) {}

  async execute(input: HandoffInput): Promise<void> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return;

    const aiName = input.aiName || 'Asistente';

    // Add note with handoff context
    const noteBody = input.summary
      ? `🤖 Handoff from ${aiName}: ${input.reason}\n\nSummary: ${input.summary}`
      : `🤖 Handoff from ${aiName}: ${input.reason}`;

    await this.noteRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      authorId: null,
      authorName: aiName,
      body: noteBody,
    });

    // Create handoff event
    const event = await this.eventRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      type: ConversationEventType.HANDOFF,
      performedBy: null,
      data: { reason: input.reason, aiAgentName: aiName },
    });
    this.gateway.emitToConversation(input.conversationId, 'conversation.event', event);

    // El bot suelta la conversación: se limpia el puntero del piloto para que
    // ningún job de IA pendiente le siga hablando al cliente por encima del
    // humano que va a tomarla.
    await this.conversationRepo.update(input.conversationId, {
      agentId: null,
      status: ConversationStatus.UNASSIGNED,
      pendingAiSince: null,
      autopilot: { enabled: true, pausedReason: null, pausedAt: null, aiNode: null },
    } as any);

    // El reparto nunca devuelve bots, así que esto no puede rebotar al mismo
    await this.autoAssign.execute(input.conversationId);

    // Emit events
    this.gateway.emitToTenant(input.tenantId, 'conversation.updated', { conversationId: input.conversationId });
  }
}
