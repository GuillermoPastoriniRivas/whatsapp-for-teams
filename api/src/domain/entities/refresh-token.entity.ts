export class RefreshToken {
  constructor(
    public readonly id: string,
    public readonly agentId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}
}
