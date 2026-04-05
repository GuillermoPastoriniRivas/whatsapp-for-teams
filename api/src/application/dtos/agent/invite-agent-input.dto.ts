import { AgentRole } from '../../../domain/enums/agent-role.enum.js';

export interface InviteAgentInput {
  tenantId: string;
  inviterName: string;
  name: string;
  email: string;
  role?: AgentRole;
}
