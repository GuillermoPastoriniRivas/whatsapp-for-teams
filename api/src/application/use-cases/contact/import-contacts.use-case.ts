import { BulkUpsertContactRow, ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { Result, ok } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

export interface ImportContactRow {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  customFields?: Record<string, string>;
}

export interface ImportContactsInput {
  tenantId: string;
  rows: ImportContactRow[];
}

export interface ImportContactsResult {
  imported: number;
  updated: number;
  skipped: Array<{ row: number; reason: string }>;
}

const MAX_ROWS = 10_000;

export class ImportContactsUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(input: ImportContactsInput): Promise<Result<ImportContactsResult, DomainError>> {
    const skipped: Array<{ row: number; reason: string }> = [];
    const valid: BulkUpsertContactRow[] = [];
    const seenWaIds = new Set<string>();

    const rows = input.rows.slice(0, MAX_ROWS);
    for (let i = rows.length; i < input.rows.length; i++) {
      skipped.push({ row: i + 1, reason: `Row limit of ${MAX_ROWS} exceeded` });
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const waId = normalizePhone(row.phone);
      if (!waId) {
        skipped.push({ row: i + 1, reason: `Invalid phone number: '${row.phone ?? ''}'` });
        continue;
      }
      if (seenWaIds.has(waId)) {
        skipped.push({ row: i + 1, reason: `Duplicate phone number in file: ${waId}` });
        continue;
      }
      seenWaIds.add(waId);

      valid.push({
        waId,
        phone: waId,
        name: row.name?.trim() || waId,
        ...(row.email?.trim() ? { email: row.email.trim() } : {}),
        ...(row.company?.trim() ? { company: row.company.trim() } : {}),
        ...(row.customFields && Object.keys(row.customFields).length > 0 ? { customFields: row.customFields } : {}),
      });
    }

    const { inserted, updated } = await this.contactRepo.bulkUpsertByWaId(input.tenantId, valid);

    return ok({ imported: inserted, updated, skipped });
  }
}

/** Normalizes to WhatsApp wa_id format: international number, digits only, no '+'. */
function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}
