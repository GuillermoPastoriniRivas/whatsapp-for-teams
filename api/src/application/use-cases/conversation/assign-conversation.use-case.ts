import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ConversationNotFoundError, AgentNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { SendPushToAgentUseCase } from '../notification/send-push-to-agent.use-case.js';

export interface AssignConversationInput {
  conversationId: string;
  agentId: string;
  tenantId: string;
}

export class AssignConversationUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRepo: AgentRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly eventRepo: ConversationEventRepository,
    private readonly sendPushToAgent: SendPushToAgentUseCase,
  ) {}

  async execute(input: AssignConversationInput): Promise<Result<Conversation, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    const newAgent = await this.agentRepo.findById(input.agentId);
    if (!newAgent) return err(new AgentNotFoundError());

    const oldAgentId = conversation.agentId;
    let oldAgentName: string | null = null;

    // Decrement old agent's load if reassigning
    if (oldAgentId) {
      const oldAgent = await this.agentRepo.findById(oldAgentId);
      oldAgentName = oldAgent?.name ?? null;
      await this.agentRepo.incrementActiveCount(oldAgentId, -1);
      this.gateway.emitToAgent(oldAgentId, 'conversation.assigned', { conversationId: conversation.id });
    }

    // Increment new agent's load
    await this.agentRepo.incrementActiveCount(input.agentId, 1);

    const updated = await this.conversationRepo.update(conversation.id, {
      agentId: input.agentId,
      status: ConversationStatus.ACTIVE,
    } as any);

    // Write event
    const isReassign = !!oldAgentId;
    const event = await this.eventRepo.create({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      type: isReassign ? ConversationEventType.REASSIGNED : ConversationEventType.ASSIGNED,
      performedBy: input.agentId,
      data: isReassign
        ? { fromAgentId: oldAgentId, fromAgentName: oldAgentName, toAgentId: input.agentId, toAgentName: newAgent.name }
        : { agentId: input.agentId, agentName: newAgent.name },
    });
    this.gateway.emitToConversation(conversation.id, 'conversation.event', event);

    this.gateway.emitToAgent(input.agentId, 'conversation.assigned', updated);

    if (newAgent.type === AgentType.HUMAN) {
      void this.sendPushToAgent.execute(input.agentId, {
        title: 'Nueva conversación asignada',
        body: 'Te asignaron una conversación',
        url: `/conversations/${conversation.id}`,
        tag: `conv-${conversation.id}`,
      });
    }

    return ok(updated!);
  }
}
