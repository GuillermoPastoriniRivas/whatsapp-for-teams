import { Contact } from '../../../domain/entities/contact.entity.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';

export interface ListContactsInput {
  tenantId: string;
  search?: string;
  page: number;
  limit: number;
}

export class ListContactsUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(input: ListContactsInput): Promise<PaginatedResult<Contact>> {
    return this.contactRepo.findByTenantId(input.tenantId, {
      search: input.search,
      page: input.page,
      limit: input.limit,
    });
  }
}
