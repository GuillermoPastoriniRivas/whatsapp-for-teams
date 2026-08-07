export class ConversationNote {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly tenantId: string,
    /** Null cuando la escribió el asistente y no una persona. */
    public readonly authorId: string | null,
    public readonly authorName: string,
    public readonly body: string,
    public readonly createdAt: Date,
  ) {}
}
