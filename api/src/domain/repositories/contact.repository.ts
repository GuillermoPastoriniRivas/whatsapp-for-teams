import { Contact } from '../entities/contact.entity.js';
import { PaginatedResult } from './conversation.repository.js';

export interface BulkUpsertContactRow {
  waId: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  customFields?: Record<string, string>;
}

export interface ContactRepository {
  upsertByWaId(
    tenantId: string,
    waId: string,
    data: { name: string; phone: string; profilePicUrl?: string | null },
  ): Promise<Contact>;
  findById(id: string): Promise<Contact | null>;
  findByTenantId(tenantId: string, options: { search?: string; page: number; limit: number }): Promise<PaginatedResult<Contact>>;
  update(
    id: string,
    data: { name?: string; email?: string | null; company?: string | null; notes?: string | null; customFields?: Record<string, string> },
  ): Promise<Contact | null>;
  bulkUpsertByWaId(tenantId: string, rows: BulkUpsertContactRow[]): Promise<{ inserted: number; updated: number }>;
  findByIds(ids: string[]): Promise<Contact[]>;
}
