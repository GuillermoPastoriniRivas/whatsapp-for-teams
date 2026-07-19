import { Contact } from '../../../domain/entities/contact.entity.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { normalizePhone } from './normalize-phone.js';

export interface CreateContactInput {
  tenantId: string;
  phone: string;
  name?: string;
}

/**
 * Find-or-create a contact by phone number, used when an agent types a number
 * by hand instead of picking it from the list. An existing contact is returned
 * untouched so a manually typed number never overwrites its saved name.
 */
export class CreateContactUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(input: CreateContactInput): Promise<Result<Contact, DomainError>> {
    const waId = normalizePhone(input.phone);
    if (!waId) {
      return err(new DomainError('INVALID_PHONE', `Invalid phone number: '${input.phone ?? ''}'`));
    }

    const existing = await this.contactRepo.findByWaId(input.tenantId, waId);
    if (existing) return ok(existing);

    const contact = await this.contactRepo.upsertByWaId(input.tenantId, waId, {
      name: input.name?.trim() || waId,
      phone: waId,
    });
    return ok(contact);
  }
}
