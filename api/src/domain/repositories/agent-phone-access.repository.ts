import { AgentPhoneAccess } from '../entities/agent-phone-access.entity.js';

export interface AgentPhoneAccessRepository {
  create(access: AgentPhoneAccess): Promise<AgentPhoneAccess>;
  delete(agentId: string, phoneNumberId: string): Promise<boolean>;
  findByAgentId(agentId: string): Promise<AgentPhoneAccess[]>;
  findByPhoneNumberId(phoneNumberId: string): Promise<AgentPhoneAccess[]>;
  exists(agentId: string, phoneNumberId: string): Promise<boolean>;
}
