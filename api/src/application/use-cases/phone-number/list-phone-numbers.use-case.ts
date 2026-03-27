import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';

export class ListPhoneNumbersUseCase {
  constructor(private readonly phoneRepo: PhoneNumberRepository) {}

  async execute(tenantId: string): Promise<PhoneNumber[]> {
    return this.phoneRepo.findByTenantId(tenantId);
  }
}
