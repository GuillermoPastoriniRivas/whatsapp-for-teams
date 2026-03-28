import { ConversationEventType } from '../enums/conversation-event-type.enum.js';

export class ConversationEvent {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly tenantId: string,
    public readonly type: ConversationEventType,
    public readonly performedBy: string | null,
    public readonly data: Record<string, unknown>,
    public readonly createdAt: Date,
  ) {}
}
