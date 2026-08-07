import { Tenant } from '../../../../domain/entities/tenant.entity.js';
import { EMPTY_BUSINESS_PROFILE } from '../../../../domain/value-objects/business-profile.js';
import { DEFAULT_AI_RATE_LIMITS } from '../../../../domain/value-objects/ai-persona.js';
import { TenantDocument } from '../schemas/tenant.schema.js';

export class TenantMapper {
  static toDomain(doc: TenantDocument): Tenant {
    return new Tenant(
      doc._id.toHexString(),
      doc.name,
      doc.slug,
      doc.createdAt,
      doc.isDemo ?? false,
      // Las cuentas anteriores a ago-2026 no lo tienen: el perfil vacío deja
      // que los nodos de IA sigan corriendo con lo que haya en el nodo.
      doc.businessProfile ?? EMPTY_BUSINESS_PROFILE,
      doc.timezone ?? null,
      doc.businessHours ?? null,
      doc.aiRateLimits ?? DEFAULT_AI_RATE_LIMITS,
    );
  }
}
