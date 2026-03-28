import { Contact } from '../../../domain/entities/contact.entity.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { Result, ok, err } from '../../common/result.js';

export class ContactNotFoundError {
  readonly code = 'CONTACT_NOT_FOUND';
  readonly message = 'Contact not found';
}

export interface UpdateContactInput {
  contactId: string;
  tenantId: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  customFields?: Record<string, string>;
}

export class UpdateContactUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(input: UpdateContactInput): Promise<Result<Contact, ContactNotFoundError>> {
    const existing = await this.contactRepo.findById(input.contactId);
    if (!existing || existing.tenantId !== input.tenantId) {
      return err(new ContactNotFoundError());
    }

    const updated = await this.contactRepo.update(input.contactId, {
      email: input.email,
      company: input.company,
      notes: input.notes,
      customFields: input.customFields,
    });

    if (!updated) return err(new ContactNotFoundError());
    return ok(updated);
  }
}
