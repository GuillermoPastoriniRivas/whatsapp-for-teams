import { Agent } from '../entities/agent.entity.js';
import { AgentStatus } from '../enums/agent-status.enum.js';

export interface AgentRepository {
  create(agent: Omit<Agent, 'id' | 'createdAt'>): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findByEmail(email: string): Promise<Agent | null>;
  findByTenantId(tenantId: string, status?: AgentStatus): Promise<Agent[]>;
  updateStatus(id: string, status: AgentStatus): Promise<Agent | null>;
  incrementActiveCount(id: string, delta: number): Promise<Agent | null>;
  findAvailableByIdsAndIncrementLoad(agentIds: string[]): Promise<Agent | null>;
}
