import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { PluginRegistry } from '../ai/plugin-registry.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';

export interface ResolveConversationInput {
  conversationId: string;
  agentId: string;
}

export class ResolveConversationUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRepo: AgentRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly eventRepo: ConversationEventRepository,
    private readonly pluginRegistry: PluginRegistry,
  ) {}

  async execute(input: ResolveConversationInput): Promise<Result<Conversation, ConversationNotFoundError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    // Get agent name for the event
    const agent = await this.agentRepo.findById(input.agentId);

    // Decrement agent's load
    if (conversation.agentId) {
      await this.agentRepo.incrementActiveCount(conversation.agentId, -1);
    }

    const updated = await this.conversationRepo.update(conversation.id, {
      status: ConversationStatus.RESOLVED,
      resolvedAt: new Date(),
      closedBy: input.agentId,
      agentId: null,
    } as any);

    // Notify all plugins to clean up their state for this conversation
    await this.pluginRegistry.onConversationResolved(conversation.id);

    const event = await this.eventRepo.create({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      type: ConversationEventType.RESOLVED,
      performedBy: input.agentId,
      data: { agentId: input.agentId, agentName: agent?.name ?? 'Unknown' },
    });
    this.gateway.emitToConversation(conversation.id, 'conversation.event', event);

    this.gateway.emitToTenant(conversation.tenantId, 'conversation.resolved', {
      conversationId: conversation.id,
    });

    return ok(updated!);
  }
}
