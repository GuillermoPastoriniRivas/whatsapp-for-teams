import { RefreshToken } from '../entities/refresh-token.entity.js';

export interface RefreshTokenRepository {
  create(data: Omit<RefreshToken, 'id' | 'createdAt'>): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  deleteByAgentId(agentId: string): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}
