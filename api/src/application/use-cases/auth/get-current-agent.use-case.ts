import { Agent } from '../../../domain/entities/agent.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError } from '../../../domain/errors/domain-errors.js';

export class GetCurrentAgentUseCase {
  constructor(private readonly agentRepo: AgentRepository) {}

  async execute(agentId: string): Promise<Result<Agent, AgentNotFoundError>> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) return err(new AgentNotFoundError());
    return ok(agent);
  }
}
