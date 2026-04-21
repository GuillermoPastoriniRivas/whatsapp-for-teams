import { AiAgentConfig, BusinessHours } from '../../../../domain/entities/ai-agent-config.entity.js';
import { AiProvider } from '../../../../domain/enums/ai-provider.enum.js';
import { AiAgentConfigDocument } from '../schemas/ai-agent-config.schema.js';

export class AiAgentConfigMapper {
  static toDomain(doc: AiAgentConfigDocument): AiAgentConfig {
    return new AiAgentConfig(
      doc._id.toHexString(),
      doc.agentId.toHexString(),
      doc.tenantId.toHexString(),
      doc.provider as AiProvider,
      doc.model,
      doc.apiKey,
      doc.systemPrompt,
      doc.knowledgeBase,
      doc.persona,
      doc.handoffRules,
      doc.contextConfig,
      doc.rateLimits,
      doc.goals ?? '',
      doc.isActive,
      doc.multiMessage ?? { enabled: false, maxBubbles: 4, interBubbleDelayMs: 1200, debounceWindowMs: 2000, debounceMaxWaitMs: 20000 },
      doc.createdAt,
      doc.updatedAt,
      doc.timezone ?? null,
      (doc.businessHours as BusinessHours | null) ?? null,
    );
  }
}
