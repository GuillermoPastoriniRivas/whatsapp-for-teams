import { Flow } from '../../../../domain/entities/flow.entity.js';
import { FlowStatus } from '../../../../domain/enums/flow-status.enum.js';
import { FlowDocument } from '../schemas/flow.schema.js';

export class FlowMapper {
  static toDomain(doc: FlowDocument): Flow {
    return new Flow(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.description ?? null,
      doc.status as FlowStatus,
      doc.draftGraph ?? { nodes: [], edges: [] },
      doc.publishedVersionId?.toHexString() ?? null,
      doc.publishedVersion ?? null,
      doc.priority ?? 100,
      doc.webhookToken ?? null,
      doc.stats ?? { started: 0, completed: 0, failed: 0, cancelled: 0 },
      doc.createdByAgentId.toHexString(),
      doc.createdAt,
      doc.updatedAt,
      doc.defaultForPhoneNumberId?.toHexString() ?? null,
    );
  }
}
