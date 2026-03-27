import { AgentPhoneAccessRepository } from '../../../domain/repositories/agent-phone-access.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';

export interface RevokePhoneAccessInput {
  agentId: string;
  phoneNumberId: string;
  tenantId: string;
}

export class RevokePhoneAccessUseCase {
  constructor(
    private readonly accessRepo: AgentPhoneAccessRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly autoAssign: AutoAssignConversationUseCase,
  ) {}

  async execute(input: RevokePhoneAccessInput): Promise<Result<void, DomainError>> {
    const deleted = await this.accessRepo.delete(input.agentId, input.phoneNumberId);
    if (!deleted) return ok(undefined);

    // Reassign active conversations this agent has on this number
    const conversations = await this.conversationRepo.findActiveByAgentAndPhone(
      input.agentId,
      input.phoneNumberId,
    );

    for (const conv of conversations) {
      await this.autoAssign.execute(conv.id);
    }

    return ok(undefined);
  }
}
