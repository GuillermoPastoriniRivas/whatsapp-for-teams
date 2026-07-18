import { PushSubscription } from '../entities/push-subscription.entity.js';

export interface PushSubscriptionRepository {
  /** Idempotent by endpoint: re-subscribing re-binds the endpoint to the given agent. */
  upsertByEndpoint(data: Omit<PushSubscription, 'id' | 'createdAt'>): Promise<PushSubscription>;
  findByAgentId(agentId: string): Promise<PushSubscription[]>;
  deleteByEndpoint(endpoint: string, agentId?: string): Promise<void>;
}
