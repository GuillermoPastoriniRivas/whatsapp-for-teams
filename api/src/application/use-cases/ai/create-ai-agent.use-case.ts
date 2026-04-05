import { Agent } from '../../../domain/entities/agent.entity.js';
import { AiAgentConfig } from '../../../domain/entities/ai-agent-config.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { CreateAiAgentInput } from '../../dtos/ai/create-ai-agent-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';

export class CreateAiAgentUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
  ) {}

  async execute(input: CreateAiAgentInput): Promise<Result<{ agent: Agent; config: AiAgentConfig }, DomainError>> {
    // Create the agent with type=AI, no password, auto-generated email
    const agent = await this.agentRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      email: `ai-${Date.now()}@hivvo.chat`,
      passwordHash: '',
      role: AgentRole.AGENT,
      status: AgentStatus.AVAILABLE,
      activeCount: 0,
      type: AgentType.AI,
      frozen: false,
    });

    const config = await this.configRepo.create({
      agentId: agent.id,
      tenantId: input.tenantId,
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      systemPrompt: input.systemPrompt ?? '',
      knowledgeBase: input.knowledgeBase ?? '',
      goals: input.goals ?? '',
      persona: input.persona,
      handoffRules: {
        keywords: input.handoffRules?.keywords ?? [],
        maxConsecutiveFailures: input.handoffRules?.maxConsecutiveFailures ?? 3,
        onCustomerRequest: input.handoffRules?.onCustomerRequest ?? true,
        urgencyKeywords: input.handoffRules?.urgencyKeywords ?? [],
      },
      contextConfig: {
        maxHistoryMessages: input.contextConfig?.maxHistoryMessages ?? 20,
        includeContactInfo: input.contextConfig?.includeContactInfo ?? true,
      },
      rateLimits: {
        maxMessagesPerDay: input.rateLimits?.maxMessagesPerDay ?? 0,
        maxTokensPerDay: input.rateLimits?.maxTokensPerDay ?? 0,
      },
      isActive: true,
    });

    return ok({ agent, config });
  }
}
