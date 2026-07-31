import { ApiKey } from '../entities/api-key.entity.js';

export interface ApiKeyRepository {
  create(data: Omit<ApiKey, 'id' | 'lastUsedAt' | 'revokedAt' | 'createdAt'>): Promise<ApiKey>;
  findById(id: string): Promise<ApiKey | null>;
  findByTenantId(tenantId: string): Promise<ApiKey[]>;
  /** Solo devuelve claves activas (no revocadas). */
  findActiveByKeyHash(keyHash: string): Promise<ApiKey | null>;
  updateLastUsed(id: string, when: Date): Promise<void>;
  revoke(id: string, when: Date): Promise<ApiKey | null>;
  countActiveByTenantId(tenantId: string): Promise<number>;
}
