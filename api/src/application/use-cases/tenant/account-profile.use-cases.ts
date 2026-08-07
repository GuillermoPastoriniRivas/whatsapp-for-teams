// ── Perfil del negocio de la cuenta ──────────────────────────────
// Los datos que los nodos de IA usan para armar su prompt: nombre, rubro,
// dirección, medios de pago, catálogo, FAQs y horarios.
//
// OJO con el nombre: esto NO es el perfil de WhatsApp del número (foto, about,
// rubro que ve el cliente al tocar el chat) — ese vive en PhoneNumber y lo
// sirve Meta. Este es interno y solo lo lee la IA.

import type { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import type { BusinessHours, BusinessProfile } from '../../../domain/value-objects/business-profile.js';
import type { AiRateLimits } from '../../../domain/value-objects/ai-persona.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

export interface AccountProfileView {
  businessProfile: BusinessProfile;
  timezone: string | null;
  businessHours: BusinessHours | null;
  aiRateLimits: AiRateLimits;
}

export class GetAccountProfileUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(tenantId: string): Promise<Result<AccountProfileView, DomainError>> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) return err(new DomainError('TENANT_NOT_FOUND', 'La cuenta no existe.'));
    return ok({
      businessProfile: tenant.businessProfile,
      timezone: tenant.timezone,
      businessHours: tenant.businessHours,
      aiRateLimits: tenant.aiRateLimits,
    });
  }
}

export interface UpdateAccountProfileInput {
  tenantId: string;
  businessProfile?: BusinessProfile;
  timezone?: string | null;
  businessHours?: BusinessHours | null;
}

export class UpdateAccountProfileUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(input: UpdateAccountProfileInput): Promise<Result<AccountProfileView, DomainError>> {
    const updated = await this.tenantRepo.updateBusinessProfile(input.tenantId, {
      businessProfile: input.businessProfile,
      timezone: input.timezone,
      businessHours: input.businessHours,
    });
    if (!updated) return err(new DomainError('TENANT_NOT_FOUND', 'La cuenta no existe.'));
    return ok({
      businessProfile: updated.businessProfile,
      timezone: updated.timezone,
      businessHours: updated.businessHours,
      aiRateLimits: updated.aiRateLimits,
    });
  }
}
