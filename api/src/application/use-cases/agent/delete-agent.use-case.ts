import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface DeleteAgentInput {
  agentId: string;
  tenantId: string;
}

export class DeleteAgentUseCase {
  constructor(private readonly agentRepo: AgentRepository) {}

  async execute(input: DeleteAgentInput): Promise<Result<void, AgentNotFoundError>> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) return err(new AgentNotFoundError());
    if (agent.tenantId !== input.tenantId) return err(new AgentNotFoundError());

    const deleted = await this.agentRepo.delete(input.agentId);
    if (!deleted) return err(new AgentNotFoundError());

    return ok(undefined);
  }
}
