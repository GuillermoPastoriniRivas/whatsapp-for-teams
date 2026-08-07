import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import type { BusinessProfilePort } from '../../ports/business-profile.port.js';
import { EMPTY_BUSINESS_PROFILE, type WhatsAppBusinessProfile } from '../../../domain/entities/whatsapp-business-profile.entity.js';
import { getProviderCapabilities } from '../../../domain/constants/provider-capabilities.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  CrossTenantAccessError,
  ProviderFeatureNotSupportedError,
} from '../../../domain/errors/domain-errors.js';

export interface BusinessProfileView {
  profile: WhatsAppBusinessProfile;
  /** Qué puede tocar la UI para este proveedor. */
  editable: boolean;
  canChangePicture: boolean;
  /** true cuando la lectura vino de la copia local porque el proveedor falló. */
  stale: boolean;
  /** Motivo, cuando `stale`. Se muestra como aviso, no como error. */
  staleReason: string | null;
}

/**
 * Lee el perfil del proveedor y refresca la copia local. Si el proveedor no
 * contesta devuelve la copia marcada como `stale`: es preferible mostrar lo
 * último que sabemos, avisando, a dejar la pantalla vacía.
 */
export class GetBusinessProfileUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly profileApi: BusinessProfilePort,
  ) {}

  async execute(tenantId: string, phoneId: string): Promise<Result<BusinessProfileView, DomainError>> {
    const phone = await this.phoneRepo.findById(phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== tenantId) return err(new CrossTenantAccessError());

    const capabilities = getProviderCapabilities(phone.provider);

    const base = {
      editable: true,
      canChangePicture: capabilities.profilePicture,
    };

    try {
      const remote = await this.profileApi.getProfile({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
      });
      // Sin perfil remoto (proveedor demo) manda nuestra copia, y no es "stale":
      // ahí no hay nada más nuevo con qué compararla.
      if (!remote) {
        return ok({ ...base, profile: phone.businessProfile ?? EMPTY_BUSINESS_PROFILE, stale: false, staleReason: null });
      }
      await this.phoneRepo.update(phoneId, { businessProfile: remote });
      return ok({ ...base, profile: remote, stale: false, staleReason: null });
    } catch (error: any) {
      return ok({
        ...base,
        profile: phone.businessProfile ?? EMPTY_BUSINESS_PROFILE,
        stale: true,
        staleReason: error?.message ?? 'No se pudo consultar al proveedor.',
      });
    }
  }
}
