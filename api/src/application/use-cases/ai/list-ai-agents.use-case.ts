import { Agent } from '../../../domain/entities/agent.entity.js';
import { AiAgentConfig } from '../../../domain/entities/ai-agent-config.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';

export interface AiAgentWithConfig {
  agent: Agent;
  config: AiAgentConfig;
}

export class ListAiAgentsUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
  ) {}

  async execute(tenantId: string): Promise<AiAgentWithConfig[]> {
    const configs = await this.configRepo.findByTenantId(tenantId);

    const results: AiAgentWithConfig[] = [];
    for (const config of configs) {
      const agent = await this.agentRepo.findById(config.agentId);
      if (agent && agent.type === AgentType.AI) {
        results.push({ agent, config });
      }
    }

    return results;
  }
}
