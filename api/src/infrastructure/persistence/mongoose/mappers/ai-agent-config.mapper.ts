import { AiAgentConfig } from '../../../../domain/entities/ai-agent-config.entity.js';
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
      doc.isActive,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
