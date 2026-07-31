import { FlowExecution } from '../../../../domain/entities/flow-execution.entity.js';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';
import { FlowExecutionDocument } from '../schemas/flow-execution.schema.js';

export class FlowExecutionMapper {
  static toDomain(doc: FlowExecutionDocument): FlowExecution {
    return new FlowExecution(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.flowId.toHexString(),
      doc.flowVersionId.toHexString(),
      doc.conversationId.toHexString(),
      doc.contactId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.status as FlowExecutionStatus,
      doc.currentNodeId ?? null,
      doc.resumeToken,
      doc.stepCount ?? 0,
      doc.waitState ?? null,
      doc.lastConsumedMessageId ?? null,
      doc.variables ?? {},
      doc.steps ?? [],
      doc.triggeredBy,
      doc.endReason ?? null,
      doc.error ?? null,
      doc.runningSince ?? null,
      doc.startedAt,
      doc.endedAt ?? null,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
