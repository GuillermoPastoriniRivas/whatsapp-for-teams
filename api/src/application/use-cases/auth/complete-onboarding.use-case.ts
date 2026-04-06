import { AgentRepository } from '../../../domain/repositories/agent.repository.js';

export class CompleteOnboardingUseCase {
  constructor(private readonly agentRepo: AgentRepository) {}

  async execute(agentId: string): Promise<void> {
    await this.agentRepo.updateRequiresOnboarding(agentId, false);
  }
}
