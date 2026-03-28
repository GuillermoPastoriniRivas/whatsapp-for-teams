import { Agent } from '../../../domain/entities/agent.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AgentPhoneAccessRepository } from '../../../domain/repositories/agent-phone-access.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';

export class AutoAssignConversationUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRepo: AgentRepository,
    private readonly accessRepo: AgentPhoneAccessRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly eventRepo: ConversationEventRepository,
  ) {}

  async execute(conversationId: string): Promise<Agent | null> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) return null;

    // Decrement old agent's load if was assigned
    if (conversation.agentId) {
      await this.agentRepo.incrementActiveCount(conversation.agentId, -1);
    }

    // Get agents with access to this phone number
    const accessList = await this.accessRepo.findByPhoneNumberId(conversation.phoneNumberId);
    const agentIds = accessList.map((a) => a.agentId);

    // Atomic: find least-loaded available agent and increment
    const agent = await this.agentRepo.findAvailableByIdsAndIncrementLoad(agentIds);

    if (!agent) {
      await this.conversationRepo.update(conversationId, {
        agentId: null,
        status: ConversationStatus.UNASSIGNED,
      } as any);

      await this.eventRepo.create({
        conversationId,
        tenantId: conversation.tenantId,
        type: ConversationEventType.UNASSIGNED,
        performedBy: null,
        data: { reason: 'No available agents' },
      });

      this.gateway.emitToTenant(conversation.tenantId, 'conversation.unassigned', { conversationId });
      return null;
    }

    // Assign conversation
    await this.conversationRepo.update(conversationId, {
      agentId: agent.id,
      status: ConversationStatus.ACTIVE,
    } as any);

    await this.eventRepo.create({
      conversationId,
      tenantId: conversation.tenantId,
      type: ConversationEventType.ASSIGNED,
      performedBy: null,
      data: { agentId: agent.id, agentName: agent.name, auto: true },
    });

    this.gateway.emitToAgent(agent.id, 'conversation.new', { conversationId });

    return agent;
  }
}
