import { Agent } from '../../../domain/entities/agent.entity.js';
import { AiAgentConfig } from '../../../domain/entities/ai-agent-config.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError, DomainError } from '../../../domain/errors/domain-errors.js';

export class GetAiAgentUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
  ) {}

  async execute(agentId: string, tenantId: string): Promise<Result<{ agent: Agent; config: AiAgentConfig }, DomainError>> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent || agent.tenantId !== tenantId) return err(new AgentNotFoundError());

    const config = await this.configRepo.findByAgentId(agentId);
    if (!config) return err(new AgentNotFoundError());

    return ok({ agent, config });
  }
}
