import { Agent } from '../../../domain/entities/agent.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UpdateAgentProfileInput {
  agentId: string;
  tenantId: string;
  name?: string;
  role?: AgentRole;
}

export class UpdateAgentProfileUseCase {
  constructor(private readonly agentRepo: AgentRepository) {}

  async execute(input: UpdateAgentProfileInput): Promise<Result<Agent, AgentNotFoundError>> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) return err(new AgentNotFoundError());
    if (agent.tenantId !== input.tenantId) return err(new AgentNotFoundError());

    const updated = await this.agentRepo.updateProfile(input.agentId, {
      name: input.name,
      role: input.role,
    });
    if (!updated) return err(new AgentNotFoundError());

    return ok(updated);
  }
}
