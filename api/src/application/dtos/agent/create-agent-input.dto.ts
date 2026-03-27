import { AgentRole } from '../../../domain/enums/agent-role.enum.js';

export interface CreateAgentInput {
  tenantId: string;
  name: string;
  email: string;
  password: string;
  role?: AgentRole;
}
