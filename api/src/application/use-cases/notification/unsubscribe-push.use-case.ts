import { PushSubscriptionRepository } from '../../../domain/repositories/push-subscription.repository.js';

export class UnsubscribePushUseCase {
  constructor(private readonly pushRepo: PushSubscriptionRepository) {}

  async execute(agentId: string, endpoint: string): Promise<void> {
    await this.pushRepo.deleteByEndpoint(endpoint, agentId);
  }
}
