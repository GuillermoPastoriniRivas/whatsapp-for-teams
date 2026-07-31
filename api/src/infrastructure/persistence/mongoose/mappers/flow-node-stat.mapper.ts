import { FlowNodeStat } from '../../../../domain/entities/flow-node-stat.entity.js';
import { FlowNodeStatDocument } from '../schemas/flow-node-stat.schema.js';

export class FlowNodeStatMapper {
  static toDomain(doc: FlowNodeStatDocument): FlowNodeStat {
    return new FlowNodeStat(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.flowId.toHexString(),
      doc.flowVersionId.toHexString(),
      doc.nodeId,
      doc.date,
      doc.entered ?? 0,
      doc.errors ?? 0,
      doc.outcomes ?? {},
    );
  }
}
