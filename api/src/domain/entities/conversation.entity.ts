import { ConversationStatus } from '../enums/conversation-status.enum.js';

export class Conversation {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly phoneNumberId: string,
    public readonly contactId: string,
    public readonly agentId: string | null,
    public readonly status: ConversationStatus,
    public readonly lastMessageAt: Date,
    public readonly lastInboundAt: Date,
    public readonly createdAt: Date,
    public readonly resolvedAt: Date | null,
    public readonly closedBy: string | null,
  ) {}
}
