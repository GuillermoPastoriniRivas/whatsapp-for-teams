export class ConversationLabel {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly tenantId: string,
    public readonly labelId: string,
    public readonly assignedBy: string,
    public readonly createdAt: Date,
  ) {}
}
