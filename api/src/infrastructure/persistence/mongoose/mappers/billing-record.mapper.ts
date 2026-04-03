import { BillingRecord } from '../../../../domain/entities/billing-record.entity.js';
import { BillingEventType } from '../../../../domain/enums/billing-event-type.enum.js';
import { PlanTier } from '../../../../domain/enums/plan-tier.enum.js';
import { BillingRecordDocument } from '../schemas/billing-record.schema.js';

export class BillingRecordMapper {
  static toDomain(doc: BillingRecordDocument): BillingRecord {
    return new BillingRecord(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.eventType as BillingEventType,
      doc.plan as PlanTier,
      doc.amountCents,
      doc.description,
      doc.createdAt,
    );
  }
}
