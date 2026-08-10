// ── ABM de proveedores ───────────────────────────────────────────
// Los terceros a los que la cuenta les pasa datos de clientes (el carpintero,
// el plomero). Ver ServiceProvider para por qué no son agentes ni contactos.

import type {
  ServiceProviderRepository,
  UpdateServiceProviderInput,
} from '../../../domain/repositories/service-provider.repository.js';
import { ServiceProvider } from '../../../domain/entities/service-provider.entity.js';
import { normalizePhone } from '../contact/normalize-phone.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

/** Normaliza un servicio a su forma canónica: minúsculas y sin espacios sobrantes. */
export function normalizeService(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export class ListServiceProvidersUseCase {
  constructor(private readonly repo: ServiceProviderRepository) {}

  execute(tenantId: string): Promise<ServiceProvider[]> {
    return this.repo.findByTenantId(tenantId);
  }
}

export interface SaveServiceProviderInput {
  tenantId: string;
  name: string;
  phone: string;
  services: string[];
  active: boolean;
  /** Debe venir en true para poder activar: es el permiso del proveedor. */
  optIn: boolean;
  optInNote?: string;
  notes?: string;
}

/**
 * Regla que sostiene todo: **no se puede activar un proveedor sin opt-in**.
 *
 * Escribirle primero por WhatsApp a alguien que no dio permiso es lo que hace
 * que Meta baje la calidad del número — y el número es del cliente, no nuestro.
 * Por eso la restricción vive acá y no en la UI: la UI se puede saltear.
 */
function assertOptIn(active: boolean, optIn: boolean): DomainError | null {
  if (active && !optIn) {
    return new DomainError(
      'PROVIDER_OPT_IN_REQUIRED',
      'Para activar un proveedor hay que registrar que aceptó recibir estos avisos por WhatsApp.',
    );
  }
  return null;
}

export class CreateServiceProviderUseCase {
  constructor(private readonly repo: ServiceProviderRepository) {}

  async execute(input: SaveServiceProviderInput): Promise<Result<ServiceProvider, DomainError>> {
    const invalid = assertOptIn(input.active, input.optIn);
    if (invalid) return err(invalid);

    const phone = normalizePhone(input.phone);
    if (!phone) return err(new DomainError('PROVIDER_BAD_PHONE', 'El teléfono del proveedor no es válido.'));

    try {
      const provider = await this.repo.create({
        tenantId: input.tenantId,
        name: input.name.trim(),
        phone,
        services: dedupeServices(input.services),
        active: input.active,
        optInAt: input.optIn ? new Date() : null,
        optInNote: input.optInNote?.trim() ?? '',
        notes: input.notes?.trim() ?? '',
      });
      return ok(provider);
    } catch (error: any) {
      if (error?.code === 11000) {
        return err(new DomainError('PROVIDER_DUPLICATE', 'Ya hay un proveedor con ese teléfono.'));
      }
      throw error;
    }
  }
}

export class UpdateServiceProviderUseCase {
  constructor(private readonly repo: ServiceProviderRepository) {}

  async execute(
    tenantId: string,
    id: string,
    input: Partial<SaveServiceProviderInput>,
  ): Promise<Result<ServiceProvider, DomainError>> {
    const current = await this.repo.findById(id);
    if (!current || current.tenantId !== tenantId) {
      return err(new DomainError('PROVIDER_NOT_FOUND', 'El proveedor no existe.'));
    }

    // El opt-in ya registrado sigue valiendo salvo que lo revoquen explícitamente.
    const willOptIn = input.optIn ?? current.optInAt !== null;
    const willBeActive = input.active ?? current.active;
    const invalid = assertOptIn(willBeActive, willOptIn);
    if (invalid) return err(invalid);

    const patch: UpdateServiceProviderInput = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.services !== undefined) patch.services = dedupeServices(input.services);
    if (input.active !== undefined) patch.active = input.active;
    if (input.notes !== undefined) patch.notes = input.notes.trim();
    if (input.optInNote !== undefined) patch.optInNote = input.optInNote.trim();

    if (input.phone !== undefined) {
      const phone = normalizePhone(input.phone);
      if (!phone) return err(new DomainError('PROVIDER_BAD_PHONE', 'El teléfono del proveedor no es válido.'));
      patch.phone = phone;
    }

    if (input.optIn !== undefined) {
      // Revocar borra la fecha; volver a darlo la vuelve a estampar. No se pisa
      // la original si ya estaba: sirve como registro de cuándo aceptó.
      patch.optInAt = input.optIn ? current.optInAt ?? new Date() : null;
    }

    try {
      const updated = await this.repo.update(id, patch);
      if (!updated) return err(new DomainError('PROVIDER_NOT_FOUND', 'El proveedor no existe.'));
      return ok(updated);
    } catch (error: any) {
      if (error?.code === 11000) {
        return err(new DomainError('PROVIDER_DUPLICATE', 'Ya hay un proveedor con ese teléfono.'));
      }
      throw error;
    }
  }
}

export class DeleteServiceProviderUseCase {
  constructor(private readonly repo: ServiceProviderRepository) {}

  async execute(tenantId: string, id: string): Promise<Result<void, DomainError>> {
    const current = await this.repo.findById(id);
    if (!current || current.tenantId !== tenantId) {
      return err(new DomainError('PROVIDER_NOT_FOUND', 'El proveedor no existe.'));
    }
    await this.repo.delete(id);
    return ok(undefined);
  }
}

function dedupeServices(services: string[]): string[] {
  return [...new Set(services.map(normalizeService).filter(Boolean))];
}
