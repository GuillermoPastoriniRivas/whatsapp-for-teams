import { Campaign } from '../../../../domain/entities/campaign.entity.js';
import { CampaignStatus } from '../../../../domain/enums/campaign-status.enum.js';
import { CampaignDocument } from '../schemas/campaign.schema.js';

export class CampaignMapper {
  static toDomain(doc: CampaignDocument): Campaign {
    return new Campaign(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.templateId.toHexString(),
      doc.name,
      doc.status as CampaignStatus,
      doc.variableMappings ?? [],
      doc.audience,
      doc.scheduledAt ?? null,
      doc.startedAt ?? null,
      doc.completedAt ?? null,
      doc.throttle,
      doc.replyWindowHours,
      doc.counts,
      doc.createdByAgentId.toHexString(),
      doc.failureReason ?? null,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
