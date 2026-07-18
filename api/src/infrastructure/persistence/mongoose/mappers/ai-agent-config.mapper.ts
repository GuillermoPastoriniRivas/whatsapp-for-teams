import { AiAgentConfig, BusinessHours, BusinessProfile, BotBehavior } from '../../../../domain/entities/ai-agent-config.entity.js';
import { AiAgentConfigDocument } from '../schemas/ai-agent-config.schema.js';

export class AiAgentConfigMapper {
  static toDomain(doc: AiAgentConfigDocument): AiAgentConfig {
    return new AiAgentConfig(
      doc._id.toHexString(),
      doc.agentId.toHexString(),
      doc.tenantId.toHexString(),
      doc.businessProfile as BusinessProfile,
      doc.behavior as BotBehavior,
      doc.handoffRules,
      doc.contextConfig,
      doc.rateLimits,
      doc.isActive,
      doc.multiMessage ?? { enabled: true, maxBubbles: 3, interBubbleDelayMs: 1200, debounceWindowMs: 2000, debounceMaxWaitMs: 20000 },
      doc.createdAt,
      doc.updatedAt,
      doc.timezone ?? null,
      (doc.businessHours as BusinessHours | null) ?? null,
    );
  }
}
