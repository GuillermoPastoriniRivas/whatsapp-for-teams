import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import type { BusinessProfilePort, BusinessProfileUpdate } from '../../ports/business-profile.port.js';
import { BUSINESS_PROFILE_LIMITS, type WhatsAppBusinessProfile } from '../../../domain/entities/whatsapp-business-profile.entity.js';
import { isBusinessVertical } from '../../../domain/enums/business-vertical.enum.js';
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

export interface UpdateBusinessProfileInput extends BusinessProfileUpdate {
  tenantId: string;
  phoneId: string;
}

/** Los campos de texto se guardan trimmeados; vacío se manda como vacío. */
function clean(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return '';
  return value.trim();
}

export class UpdateBusinessProfileUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly profileApi: BusinessProfilePort,
  ) {}

  async execute(input: UpdateBusinessProfileInput): Promise<Result<WhatsAppBusinessProfile, DomainError>> {
    const phone = await this.phoneRepo.findById(input.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    const invalid = this.validate(input);
    if (invalid) return err(invalid);

    const ctx = {
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
    };

    // El formulario manda el perfil entero, cambie lo que cambie. Mandarle a
    // Meta campos que ya valen lo mismo —`email: ""` cuando nunca hubo mail,
    // `websites: []` sobre una lista vacía— le saca un 131000 "Something went
    // wrong", sin decir cuál. Así que se manda únicamente lo que cambia.
    //
    // La comparación va contra lo que el proveedor tiene ahora, no contra la
    // copia local, que puede haber quedado vieja si alguien tocó el perfil
    // desde el Business Manager.
    let current: WhatsAppBusinessProfile | null = phone.businessProfile ?? null;
    try {
      current = (await this.profileApi.getProfile(ctx)) ?? current;
    } catch {
      // Si no contesta se compara contra la copia local: peor es no poder guardar.
    }

    const update = this.diff(input, current);

    // Sin cambios no se llama al proveedor: no hay nada que mandar y el
    // intento vacío es justamente el que falla.
    if (Object.keys(update).length === 0) {
      const unchanged = current ?? this.merge(phone.businessProfile, {});
      await this.phoneRepo.update(input.phoneId, { businessProfile: unchanged });
      return ok(unchanged);
    }

    try {
      await this.profileApi.updateProfile(ctx, update);
    } catch (error: any) {
      return err(new BusinessProfileProviderError(error?.message));
    }

    // Se relee del proveedor para no inventar la copia local: la foto, por
    // ejemplo, vuelve como URL nueva y el `vertical` puede venir normalizado.
    // Si no contesta —o si no guarda perfil propio— se arma con lo enviado.
    let profile: WhatsAppBusinessProfile;
    try {
      profile = (await this.profileApi.getProfile(ctx)) ?? this.merge(phone.businessProfile, update);
    } catch {
      profile = this.merge(phone.businessProfile, update);
    }

    await this.phoneRepo.update(input.phoneId, { businessProfile: profile });
    return ok(profile);
  }

  /**
   * Lo que hay que mandarle al proveedor: solo los campos que cambian de valor.
   * Un campo ausente en el update es "no lo toques"; uno en cadena vacía es
   * "borralo", y eso solo se manda si antes tenía algo.
   */
  private diff(
    input: UpdateBusinessProfileInput,
    current: WhatsAppBusinessProfile | null,
  ): BusinessProfileUpdate {
    const update: BusinessProfileUpdate = {};

    const text = (
      field: 'about' | 'address' | 'description' | 'email',
    ) => {
      const next = clean(input[field]);
      if (next === undefined) return;
      if (next === (current?.[field] ?? '')) return;
      update[field] = next;
    };

    text('about');
    text('address');
    text('description');
    text('email');

    if (input.vertical !== undefined) {
      const next = input.vertical || 'UNDEFINED';
      if (next !== (current?.vertical || 'UNDEFINED')) update.vertical = next;
    }

    if (input.websites !== undefined) {
      const next = input.websites.map((w) => w.trim()).filter(Boolean);
      const previous = current?.websites ?? [];
      if (next.join('\n') !== previous.join('\n')) update.websites = next;
    }

    // La foto siempre viaja: el handle es de un solo uso y solo llega cuando se
    // subió una imagen nueva, así que nunca es redundante.
    if (input.profilePictureHandle !== undefined) {
      update.profilePictureHandle = input.profilePictureHandle;
    }

    return update;
  }

  private validate(input: UpdateBusinessProfileInput): DomainError | null {
    const tooLong = (value: string | null | undefined, max: number, field: string) =>
      typeof value === 'string' && value.trim().length > max
        ? new InvalidBusinessProfileError(`"${field}" supera los ${max} caracteres.`)
        : null;

    const lengths =
      tooLong(input.about, BUSINESS_PROFILE_LIMITS.about, 'about') ??
      tooLong(input.address, BUSINESS_PROFILE_LIMITS.address, 'address') ??
      tooLong(input.description, BUSINESS_PROFILE_LIMITS.description, 'description') ??
      tooLong(input.email, BUSINESS_PROFILE_LIMITS.email, 'email');
    if (lengths) return lengths;

    if (input.email) {
      const email = input.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new InvalidBusinessProfileError('El mail de contacto no es válido.');
      }
    }

    if (input.vertical !== undefined && input.vertical && !isBusinessVertical(input.vertical)) {
      return new InvalidBusinessProfileError(`Rubro desconocido: ${input.vertical}`);
    }

    if (input.websites) {
      const websites = input.websites.map((w) => w.trim()).filter(Boolean);
      if (websites.length > BUSINESS_PROFILE_LIMITS.websites) {
        return new InvalidBusinessProfileError(
          `WhatsApp acepta hasta ${BUSINESS_PROFILE_LIMITS.websites} sitios web.`,
        );
      }
      for (const website of websites) {
        if (website.length > BUSINESS_PROFILE_LIMITS.websiteUrl) {
          return new InvalidBusinessProfileError(`"${website}" supera los ${BUSINESS_PROFILE_LIMITS.websiteUrl} caracteres.`);
        }
        if (!/^https?:\/\//i.test(website)) {
          return new InvalidBusinessProfileError(`"${website}" tiene que empezar con http:// o https://`);
        }
      }
    }

    return null;
  }

  /** Fallback cuando el proveedor acepta el cambio pero después no responde. */
  private merge(current: WhatsAppBusinessProfile | null, update: BusinessProfileUpdate): WhatsAppBusinessProfile {
    const pick = (next: string | null | undefined, previous: string | null) =>
      next === undefined ? previous : next || null;

    return {
      about: pick(update.about, current?.about ?? null),
      address: pick(update.address, current?.address ?? null),
      description: pick(update.description, current?.description ?? null),
      email: pick(update.email, current?.email ?? null),
      vertical: pick(update.vertical, current?.vertical ?? null),
      websites: update.websites ?? current?.websites ?? [],
      profilePictureUrl: current?.profilePictureUrl ?? null,
    };
  }
}
