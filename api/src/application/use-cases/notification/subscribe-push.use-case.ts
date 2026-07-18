import { PushSubscription, PushSubscriptionKeys } from '../../../domain/entities/push-subscription.entity.js';
import { PushSubscriptionRepository } from '../../../domain/repositories/push-subscription.repository.js';

export interface SubscribePushInput {
  tenantId: string;
  agentId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string | null;
}

export class SubscribePushUseCase {
  constructor(private readonly pushRepo: PushSubscriptionRepository) {}

  async execute(input: SubscribePushInput): Promise<PushSubscription> {
    return this.pushRepo.upsertByEndpoint({
      tenantId: input.tenantId,
      agentId: input.agentId,
      endpoint: input.endpoint,
      keys: input.keys,
      userAgent: input.userAgent ?? null,
    });
  }
}
