import { AgentRole } from '../enums/agent-role.enum.js';
import { AgentStatus } from '../enums/agent-status.enum.js';
import { AgentType } from '../enums/agent-type.enum.js';

export class Agent {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly role: AgentRole,
    public readonly status: AgentStatus,
    public readonly activeCount: number,
    public readonly createdAt: Date,
    public readonly type: AgentType = AgentType.HUMAN,
    public readonly frozen: boolean = false,
    public readonly emailVerified: boolean = true,
  ) {}
}
