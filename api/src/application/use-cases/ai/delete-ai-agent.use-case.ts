import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError, DomainError } from '../../../domain/errors/domain-errors.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';

export class DeleteAiAgentUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
  ) {}

  async execute(agentId: string, tenantId: string): Promise<Result<void, DomainError>> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent || agent.tenantId !== tenantId) return err(new AgentNotFoundError());

    // Set agent offline (this will trigger reassignment of active conversations via existing logic)
    await this.agentRepo.updateStatus(agentId, AgentStatus.OFFLINE);

    // Deactivate AI config
    await this.configRepo.update(agentId, { isActive: false } as any);

    return ok(undefined);
  }
}
