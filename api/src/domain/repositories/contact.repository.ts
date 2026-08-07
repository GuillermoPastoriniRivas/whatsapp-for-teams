import { Contact } from '../entities/contact.entity.js';
import { PaginatedResult } from './conversation.repository.js';

/** Los ejes de identidad que puede traer un webhook o una carga manual. */
export interface ContactIdentity {
  phone?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  username?: string | null;
  portfolioId?: string | null;
}

export interface ContactProfile {
  name?: string;
  profilePicUrl?: string | null;
}

export interface BulkUpsertContactRow {
  phone: string;
  name: string;
  email?: string | null;
  company?: string | null;
  customFields?: Record<string, string>;
}

export interface ContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByPhone(tenantId: string, phone: string): Promise<Contact | null>;
  /** El BSUID solo es único dentro de su portfolio; nunca se busca suelto. */
  findByBsuid(tenantId: string, portfolioId: string, bsuid: string): Promise<Contact | null>;
  create(tenantId: string, identity: ContactIdentity, profile: ContactProfile): Promise<Contact>;
  /**
   * Escribe los ejes de identidad presentes sobre un contacto ya resuelto y
   * refresca `lastSeenAt`. Los campos ausentes no se pisan: un webhook sin
   * teléfono no puede borrar el que ya teníamos guardado.
   */
  applyIdentity(id: string, identity: ContactIdentity, profile: ContactProfile): Promise<Contact | null>;
  findByTenantId(tenantId: string, options: { search?: string; page: number; limit: number }): Promise<PaginatedResult<Contact>>;
  update(
    id: string,
    data: { name?: string; email?: string | null; company?: string | null; notes?: string | null; customFields?: Record<string, string> },
  ): Promise<Contact | null>;
  bulkUpsertByPhone(tenantId: string, rows: BulkUpsertContactRow[]): Promise<{ inserted: number; updated: number }>;
  findByIds(ids: string[]): Promise<Contact[]>;
  delete(id: string): Promise<void>;
  /**
   * Marca (o levanta) el opt-out de marketing. `at: null` lo reactiva.
   * Devuelve `null` si no hay un contacto con esa identidad en el tenant.
   */
  setMarketingOptOut(tenantId: string, identity: ContactIdentity, at: Date | null): Promise<Contact | null>;
}

/**
 * Fusión de dos contactos que resultaron ser la misma persona. Vive aparte del
 * `ContactRepository` porque toca conversaciones, mensajes, campañas, flujos y
 * media — y solo lo usa el camino de resolución de identidad.
 */
export interface ContactMergeRepository {
  /** Mueve todo lo que cuelga de `duplicateId` a `survivorId` y borra el duplicado. */
  merge(survivorId: string, duplicateId: string): Promise<void>;
}
