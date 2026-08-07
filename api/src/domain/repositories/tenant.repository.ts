import { Tenant } from '../entities/tenant.entity.js';
import type { BusinessHours, BusinessProfile } from '../value-objects/business-profile.js';

export interface UpdateTenantBusinessInput {
  businessProfile?: BusinessProfile;
  timezone?: string | null;
  businessHours?: BusinessHours | null;
}

export interface TenantRepository {
  create(
    tenant: Omit<
      Tenant,
      'id' | 'createdAt' | 'isDemo' | 'businessProfile' | 'timezone' | 'businessHours' | 'aiRateLimits'
    > & {
      isDemo?: boolean;
    },
  ): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  /** Los datos del negocio que alimentan a los nodos de IA. */
  updateBusinessProfile(id: string, patch: UpdateTenantBusinessInput): Promise<Tenant | null>;
}
