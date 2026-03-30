import { AiAgentConfig } from '../../../domain/entities/ai-agent-config.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError, DomainError } from '../../../domain/errors/domain-errors.js';

export class UpdateAiAgentConfigUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
  ) {}

  async execute(agentId: string, tenantId: string, data: Partial<AiAgentConfig>): Promise<Result<AiAgentConfig, DomainError>> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent || agent.tenantId !== tenantId) return err(new AgentNotFoundError());

    // If name is being updated, update the agent entity too
    if (data.agentId || data.tenantId || data.id) {
      // Don't allow changing identity fields
      delete (data as any).agentId;
      delete (data as any).tenantId;
      delete (data as any).id;
    }

    const config = await this.configRepo.update(agentId, data);
    if (!config) return err(new AgentNotFoundError());

    return ok(config);
  }
}
