import { Tenant } from '../../../domain/entities/tenant.entity.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import { Result, ok } from '../../common/result.js';

export interface CreateTenantInput {
  name: string;
  slug: string;
}

export class CreateTenantUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(input: CreateTenantInput): Promise<Result<Tenant, never>> {
    const tenant = await this.tenantRepo.create(input);
    return ok(tenant);
  }
}
