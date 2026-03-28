export class ConversationNote {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly tenantId: string,
    public readonly authorId: string,
    public readonly authorName: string,
    public readonly body: string,
    public readonly createdAt: Date,
  ) {}
}
