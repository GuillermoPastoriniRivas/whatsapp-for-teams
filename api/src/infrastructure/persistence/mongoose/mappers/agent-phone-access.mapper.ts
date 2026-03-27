import { AgentPhoneAccess } from '../../../../domain/entities/agent-phone-access.entity.js';
import { AgentPhoneAccessDocument } from '../schemas/agent-phone-access.schema.js';

export class AgentPhoneAccessMapper {
  static toDomain(doc: AgentPhoneAccessDocument): AgentPhoneAccess {
    return new AgentPhoneAccess(
      doc.agentId.toHexString(),
      doc.phoneNumberId.toHexString(),
    );
  }
}
