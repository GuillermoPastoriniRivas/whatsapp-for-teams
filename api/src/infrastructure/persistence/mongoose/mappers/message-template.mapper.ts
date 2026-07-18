import { MessageTemplate, MessageTemplateComponent } from '../../../../domain/entities/message-template.entity.js';
import { TemplateCategory } from '../../../../domain/enums/template-category.enum.js';
import { TemplateQuality } from '../../../../domain/enums/template-quality.enum.js';
import { TemplateStatus } from '../../../../domain/enums/template-status.enum.js';
import { MessageTemplateDocument } from '../schemas/message-template.schema.js';

export class MessageTemplateMapper {
  static toDomain(doc: MessageTemplateDocument): MessageTemplate {
    return new MessageTemplate(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.wabaId,
      doc.metaTemplateId ?? null,
      doc.name,
      doc.language,
      doc.category as TemplateCategory,
      doc.status as TemplateStatus,
      (doc.qualityScore as TemplateQuality) ?? TemplateQuality.UNKNOWN,
      (doc.components ?? []) as unknown as MessageTemplateComponent[],
      doc.rejectionReason ?? null,
      doc.lastSyncedAt ?? null,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
