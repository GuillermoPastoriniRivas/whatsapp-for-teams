import { Agent } from '../entities/agent.entity.js';
import { AgentRole } from '../enums/agent-role.enum.js';
import { AgentStatus } from '../enums/agent-status.enum.js';
import { AgentType } from '../enums/agent-type.enum.js';

export interface AgentRepository {
  create(agent: Omit<Agent, 'id' | 'createdAt'>): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findByEmail(email: string): Promise<Agent | null>;
  findByTenantId(tenantId: string, status?: AgentStatus): Promise<Agent[]>;
  updateStatus(id: string, status: AgentStatus): Promise<Agent | null>;
  incrementActiveCount(id: string, delta: number): Promise<Agent | null>;
  findAvailableByIdsAndIncrementLoad(agentIds: string[], excludeType?: AgentType): Promise<Agent | null>;
  updateName(id: string, name: string): Promise<Agent | null>;
  updateProfile(id: string, data: { name?: string; role?: AgentRole }): Promise<Agent | null>;
  delete(id: string): Promise<boolean>;
  countByTenantIdAndType(tenantId: string, type: AgentType): Promise<number>;
  updateFrozen(id: string, frozen: boolean): Promise<Agent | null>;
  findByTenantIdAndType(tenantId: string, type: AgentType): Promise<Agent[]>;
  updatePasswordHash(id: string, passwordHash: string): Promise<Agent | null>;
  updateEmailVerified(id: string, emailVerified: boolean): Promise<Agent | null>;
  updateRequiresOnboarding(id: string, value: boolean): Promise<Agent | null>;
}
