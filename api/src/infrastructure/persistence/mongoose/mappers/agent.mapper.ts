import { Agent } from '../../../../domain/entities/agent.entity.js';
import { AgentRole } from '../../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../../domain/enums/agent-type.enum.js';
import { AgentDocument } from '../schemas/agent.schema.js';

export class AgentMapper {
  static toDomain(doc: AgentDocument): Agent {
    return new Agent(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.email,
      doc.passwordHash,
      doc.role as AgentRole,
      doc.status as AgentStatus,
      doc.activeCount,
      doc.createdAt,
      (doc.type as AgentType) ?? AgentType.HUMAN,
      doc.frozen ?? false,
      doc.emailVerified ?? true,
    );
  }
}
