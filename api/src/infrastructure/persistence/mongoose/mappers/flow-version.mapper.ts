import { FlowVersion } from '../../../../domain/entities/flow-version.entity.js';
import { FlowVersionDocument } from '../schemas/flow-version.schema.js';

export class FlowVersionMapper {
  static toDomain(doc: FlowVersionDocument): FlowVersion {
    return new FlowVersion(
      doc._id.toHexString(),
      doc.flowId.toHexString(),
      doc.tenantId.toHexString(),
      doc.version,
      doc.graph,
      doc.trigger,
      doc.publishedByAgentId.toHexString(),
      doc.createdAt,
    );
  }
}
