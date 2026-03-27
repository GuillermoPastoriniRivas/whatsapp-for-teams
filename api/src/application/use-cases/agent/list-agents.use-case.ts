import { Agent } from '../../../domain/entities/agent.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';

export class ListAgentsUseCase {
  constructor(private readonly agentRepo: AgentRepository) {}

  async execute(tenantId: string, status?: AgentStatus): Promise<Agent[]> {
    return this.agentRepo.findByTenantId(tenantId, status);
  }
}
