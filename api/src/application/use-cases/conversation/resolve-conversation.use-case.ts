import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';

export interface ResolveConversationInput {
  conversationId: string;
  agentId: string;
}

export class ResolveConversationUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRepo: AgentRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: ResolveConversationInput): Promise<Result<Conversation, ConversationNotFoundError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

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

    this.gateway.emitToTenant(conversation.tenantId, 'conversation.resolved', {
      conversationId: conversation.id,
    });

    return ok(updated!);
  }
}
