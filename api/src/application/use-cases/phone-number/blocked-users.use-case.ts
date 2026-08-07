import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneAdminPort } from '../../ports/phone-admin.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  CrossTenantAccessError,
} from '../../../domain/errors/domain-errors.js';

export interface BlockedUserView {
  waId: string;
  /** Contacto nuestro con ese teléfono, si lo hay. */
  contactId: string | null;
  name: string | null;
}

/**
 * Lista de bloqueados del número (Block API de Meta).
 *
 * Bloquear corta el spam de raíz: el usuario deja de poder escribirle al número.
 * Se resuelve contra nuestros contactos para que la pantalla muestre nombres y
 * no una lista de teléfonos pelados.
 */
export class ListBlockedUsersUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly contactRepo: ContactRepository,
    private readonly admin: PhoneAdminPort,
  ) {}

  async execute(tenantId: string, phoneId: string): Promise<Result<BlockedUserView[], DomainError>> {
    const phone = await this.phoneRepo.findById(phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== tenantId) return err(new CrossTenantAccessError());

    const blocked = await this.admin.listBlockedUsers({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
    });

    const views = await Promise.all(
      blocked.map(async ({ waId }) => {
        const contact = await this.contactRepo.findByPhone(tenantId, waId).catch(() => null);
        return { waId, contactId: contact?.id ?? null, name: contact?.displayName ?? null };
      }),
    );

    return ok(views);
  }
}

export class BlockUsersUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
  ) {}

  async execute(
    tenantId: string,
    phoneId: string,
    waIds: string[],
    action: 'block' | 'unblock',
  ): Promise<Result<{ affected: number }, DomainError>> {
    const phone = await this.phoneRepo.findById(phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== tenantId) return err(new CrossTenantAccessError());

    // Meta direcciona por teléfono en dígitos; un '+' o espacios lo rechazan.
    const normalized = [...new Set(waIds.map((waId) => waId.replace(/\D/g, '')).filter(Boolean))];
    if (normalized.length === 0) {
      return err(new DomainError('INVALID_PHONE', 'No hay números válidos para bloquear.'));
    }

    const ctx = {
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
    };

    if (action === 'block') await this.admin.blockUsers(ctx, normalized);
    else await this.admin.unblockUsers(ctx, normalized);

    return ok({ affected: normalized.length });
  }
}
