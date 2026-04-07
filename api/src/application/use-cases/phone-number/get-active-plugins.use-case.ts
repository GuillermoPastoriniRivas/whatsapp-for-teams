import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';

export class GetActivePluginsUseCase {
  constructor(private readonly phoneRepo: PhoneNumberRepository) {}

  async execute(tenantId: string): Promise<string[]> {
    const phones = await this.phoneRepo.findByTenantId(tenantId);
    const allPlugins = phones.flatMap((p) => p.plugins);
    return [...new Set(allPlugins)];
  }
}
