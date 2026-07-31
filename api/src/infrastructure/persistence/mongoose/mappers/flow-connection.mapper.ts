import { FlowConnection } from '../../../../domain/entities/flow-connection.entity.js';
import { FlowConnectionDocument } from '../schemas/flow-connection.schema.js';

export class FlowConnectionMapper {
  static toDomain(doc: FlowConnectionDocument): FlowConnection {
    return new FlowConnection(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.headerName,
      doc.secretEncrypted,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
