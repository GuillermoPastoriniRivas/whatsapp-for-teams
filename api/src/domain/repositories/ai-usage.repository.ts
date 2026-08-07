import { AiUsage } from '../entities/ai-usage.entity.js';

export interface AiUsageRepository {
  incrementUsage(tenantId: string, date: string, messageDelta: number, tokenDelta: number): Promise<AiUsage>;
  getUsage(tenantId: string, date: string): Promise<AiUsage | null>;
}
