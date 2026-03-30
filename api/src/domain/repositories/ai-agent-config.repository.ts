import { AiAgentConfig } from '../entities/ai-agent-config.entity.js';

export interface AiAgentConfigRepository {
  create(config: Omit<AiAgentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiAgentConfig>;
  findByAgentId(agentId: string): Promise<AiAgentConfig | null>;
  findByTenantId(tenantId: string): Promise<AiAgentConfig[]>;
  update(agentId: string, data: Partial<AiAgentConfig>): Promise<AiAgentConfig | null>;
  delete(agentId: string): Promise<void>;
}
