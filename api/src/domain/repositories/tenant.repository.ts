import { Tenant } from '../entities/tenant.entity.js';

export interface TenantRepository {
  create(tenant: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
}
