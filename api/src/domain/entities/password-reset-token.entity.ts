export type PasswordResetTokenType = 'reset' | 'invitation';

export class PasswordResetToken {
  constructor(
    public readonly id: string,
    public readonly agentId: string,
    public readonly tokenHash: string,
    public readonly type: PasswordResetTokenType,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}
}
