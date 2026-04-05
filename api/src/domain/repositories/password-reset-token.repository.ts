import { PasswordResetToken } from '../entities/password-reset-token.entity.js';

export interface PasswordResetTokenRepository {
  create(data: Omit<PasswordResetToken, 'id' | 'createdAt'>): Promise<PasswordResetToken>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  deleteByAgentId(agentId: string): Promise<void>;
}
