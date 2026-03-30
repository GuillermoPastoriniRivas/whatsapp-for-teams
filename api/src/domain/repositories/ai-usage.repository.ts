import { AiUsage } from '../entities/ai-usage.entity.js';

export interface AiUsageRepository {
  incrementUsage(tenantId: string, aiAgentId: string, date: string, messageDelta: number, tokenDelta: number): Promise<AiUsage>;
  getUsage(tenantId: string, aiAgentId: string, date: string): Promise<AiUsage | null>;
}
