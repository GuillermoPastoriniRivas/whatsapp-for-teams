import { Logger } from '@nestjs/common';
import { Contact } from '../../../domain/entities/contact.entity.js';
import { ContactMergeRepository, ContactRepository } from '../../../domain/repositories/contact.repository.js';

export interface ResolveContactIdentityInput {
  tenantId: string;
  /** Scope del BSUID: `portfolioId` del número, con `wabaId` como respaldo. */
  portfolioId: string;
  phone?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  username?: string | null;
  name?: string;
  profilePicUrl?: string | null;
}

/**
 * Resuelve a qué contacto pertenece una identidad entrante, fusionando cuando
 * los dos ejes apuntaban a registros distintos.
 *
 * El caso real: alguien que conocíamos solo por BSUID comparte su teléfono
 * (`REQUEST_CONTACT_INFO` o el contact book de Meta) y ese número ya existía
 * como contacto cargado por CSV, campaña o API.
 */
export class ResolveContactIdentityUseCase {
  private readonly logger = new Logger(ResolveContactIdentityUseCase.name);

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly mergeRepo: ContactMergeRepository,
  ) {}

  async execute(input: ResolveContactIdentityInput): Promise<Contact> {
    const { tenantId, portfolioId, phone, bsuid } = input;

    const [byBsuid, byPhone] = await Promise.all([
      bsuid ? this.contactRepo.findByBsuid(tenantId, portfolioId, bsuid) : Promise.resolve(null),
      phone ? this.contactRepo.findByPhone(tenantId, phone) : Promise.resolve(null),
    ]);

    const identity = {
      phone: phone ?? null,
      bsuid: bsuid ?? null,
      parentBsuid: input.parentBsuid ?? null,
      username: input.username ?? null,
      portfolioId: bsuid ? portfolioId : null,
    };
    const profile = { name: input.name, profilePicUrl: input.profilePicUrl };

    const survivor = await this.resolveSurvivor(byBsuid, byPhone);
    if (!survivor) return this.contactRepo.create(tenantId, identity, profile);

    const updated = await this.contactRepo.applyIdentity(survivor.id, identity, profile);
    return updated ?? survivor;
  }

  /**
   * Con dos candidatos distintos sobrevive el más antiguo: es el que acumuló
   * más historia, y la regla es determinista si el webhook se reentrega.
   */
  private async resolveSurvivor(byBsuid: Contact | null, byPhone: Contact | null): Promise<Contact | null> {
    if (!byBsuid) return byPhone;
    if (!byPhone) return byBsuid;
    if (byBsuid.id === byPhone.id) return byBsuid;

    const [survivor, duplicate] =
      byBsuid.createdAt <= byPhone.createdAt ? [byBsuid, byPhone] : [byPhone, byBsuid];

    this.logger.log(
      `Identidad duplicada: se fusiona ${duplicate.id} dentro de ${survivor.id} (teléfono revelado para un contacto conocido por BSUID)`,
    );
    await this.mergeRepo.merge(survivor.id, duplicate.id);

    return (await this.contactRepo.findById(survivor.id)) ?? survivor;
  }
}
