import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ConversationNotFoundError, AgentNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';

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
  ) {}

  async execute(input: AssignConversationInput): Promise<Result<Conversation, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    const newAgent = await this.agentRepo.findById(input.agentId);
    if (!newAgent) return err(new AgentNotFoundError());

    // Decrement old agent's load if reassigning
    if (conversation.agentId) {
      await this.agentRepo.incrementActiveCount(conversation.agentId, -1);
      this.gateway.emitToAgent(conversation.agentId, 'conversation.assigned', { conversationId: conversation.id });
    }

    // Increment new agent's load
    await this.agentRepo.incrementActiveCount(input.agentId, 1);

    const updated = await this.conversationRepo.update(conversation.id, {
      agentId: input.agentId,
      status: ConversationStatus.ACTIVE,
    } as any);

    this.gateway.emitToAgent(input.agentId, 'conversation.assigned', updated);

    return ok(updated!);
  }
}
