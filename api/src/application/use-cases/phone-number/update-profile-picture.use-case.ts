import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import type { BusinessProfilePort } from '../../ports/business-profile.port.js';
import type { WhatsAppBusinessProfile } from '../../../domain/entities/whatsapp-business-profile.entity.js';
import { getProviderCapabilities } from '../../../domain/constants/provider-capabilities.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  CrossTenantAccessError,
  ProviderFeatureNotSupportedError,
  BusinessProfileProviderError,
  InvalidBusinessProfileError,
} from '../../../domain/errors/domain-errors.js';

/** Lo que Meta acepta como foto de perfil. */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024;

export interface UpdateProfilePictureInput {
  tenantId: string;
  phoneId: string;
  file: Buffer;
  mimeType: string;
}

/**
 * Sube la foto al proveedor y la deja como foto de perfil del número. Son dos
 * viajes: la subida devuelve un handle y recién ese handle se puede guardar en
 * el perfil (Meta no acepta una URL).
 */
export class UpdateProfilePictureUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly profileApi: BusinessProfilePort,
  ) {}

  async execute(input: UpdateProfilePictureInput): Promise<Result<WhatsAppBusinessProfile, DomainError>> {
    const phone = await this.phoneRepo.findById(input.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    if (!getProviderCapabilities(phone.provider).profilePicture) {
      return err(new ProviderFeatureNotSupportedError('Profile picture', phone.provider));
    }

    const mimeType = input.mimeType?.toLowerCase() ?? '';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return err(new InvalidBusinessProfileError('La foto tiene que ser JPG o PNG.'));
    }
    if (input.file.length > MAX_BYTES) {
      return err(new InvalidBusinessProfileError('La foto no puede pesar más de 5 MB.'));
    }

    const ctx = {
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
    };

    let profile: WhatsAppBusinessProfile | null;
    try {
      const handle = await this.profileApi.uploadProfilePicture(ctx, input.file, mimeType);
      await this.profileApi.updateProfile(ctx, { profilePictureHandle: handle });
      profile = await this.profileApi.getProfile(ctx);
    } catch (error: any) {
      return err(new BusinessProfileProviderError(error?.message));
    }

    // Solo llegan acá proveedores con perfil propio (la capacidad lo garantiza),
    // así que la relectura tiene que traer algo.
    if (!profile) return err(new BusinessProfileProviderError('El proveedor no devolvió el perfil actualizado.'));

    await this.phoneRepo.update(input.phoneId, { businessProfile: profile });
    return ok(profile);
  }
}
