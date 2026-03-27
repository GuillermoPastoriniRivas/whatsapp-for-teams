import { Agent } from '../../../domain/entities/agent.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError } from '../../../domain/errors/domain-errors.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';

export interface UpdateAgentStatusInput {
  agentId: string;
  tenantId: string;
  status: AgentStatus;
}

export class UpdateAgentStatusUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly autoAssign: AutoAssignConversationUseCase,
  ) {}

  async execute(input: UpdateAgentStatusInput): Promise<Result<Agent, AgentNotFoundError>> {
    const agent = await this.agentRepo.updateStatus(input.agentId, input.status);
    if (!agent) return err(new AgentNotFoundError());

    // If going offline, reassign all active conversations
    if (input.status === AgentStatus.OFFLINE) {
      const activeConversations = await this.conversationRepo.findActiveByAgentId(input.agentId);
      for (const conv of activeConversations) {
        await this.autoAssign.execute(conv.id);
      }
    }

    return ok(agent);
  }
}
