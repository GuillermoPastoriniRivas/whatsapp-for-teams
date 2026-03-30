import { AiUsage } from '../../../../domain/entities/ai-usage.entity.js';
import { AiUsageDocument } from '../schemas/ai-usage.schema.js';

export class AiUsageMapper {
  static toDomain(doc: AiUsageDocument): AiUsage {
    return new AiUsage(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.aiAgentId.toHexString(),
      doc.date,
      doc.messageCount,
      doc.tokenCount,
    );
  }
}
