import { ConversationStatus } from '../enums/conversation-status.enum.js';
import type { OrderFlowData } from '../value-objects/order-flow.types.js';

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
    public readonly summary: string | null = null,
    public readonly orderFlow: OrderFlowData | null = null,
  ) {}
}
