export class Contact {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly waId: string,
    public readonly name: string,
    public readonly phone: string,
    public readonly profilePicUrl: string | null,
    public readonly lastSeenAt: Date,
    public readonly createdAt: Date,
    public readonly email: string | null = null,
    public readonly company: string | null = null,
    public readonly notes: string | null = null,
    public readonly customFields: Record<string, string> = {},
  ) {}
}
