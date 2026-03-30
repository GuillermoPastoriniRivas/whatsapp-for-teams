import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationNoteRepository } from '../../../domain/repositories/conversation-note.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';

export interface HandoffInput {
  conversationId: string;
  aiAgentId: string;
  tenantId: string;
  reason: string;
  summary?: string;
}

export class HandoffToHumanUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRepo: AgentRepository,
    private readonly noteRepo: ConversationNoteRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly autoAssign: AutoAssignConversationUseCase,
  ) {}

  async execute(input: HandoffInput): Promise<void> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return;

    const aiAgent = await this.agentRepo.findById(input.aiAgentId);
    const aiName = aiAgent?.name ?? 'AI Agent';

    // Add note with handoff context
    const noteBody = input.summary
      ? `🤖 Handoff from ${aiName}: ${input.reason}\n\nSummary: ${input.summary}`
      : `🤖 Handoff from ${aiName}: ${input.reason}`;

    await this.noteRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      authorId: input.aiAgentId,
      authorName: aiName,
      body: noteBody,
    });

    // Create handoff event
    await this.eventRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      type: ConversationEventType.HANDOFF,
      performedBy: input.aiAgentId,
      data: { reason: input.reason, aiAgentName: aiName },
    });

    // Decrement AI agent's active count
    await this.agentRepo.incrementActiveCount(input.aiAgentId, -1);

    // Set conversation to unassigned so auto-assign can pick a human
    await this.conversationRepo.update(input.conversationId, {
      agentId: null,
      status: ConversationStatus.UNASSIGNED,
    } as any);

    // Auto-assign to human only (excludeAi=true)
    await this.autoAssign.execute(input.conversationId, { excludeAi: true });

    // Emit events
    this.gateway.emitToTenant(input.tenantId, 'conversation.updated', { conversationId: input.conversationId });
  }
}
