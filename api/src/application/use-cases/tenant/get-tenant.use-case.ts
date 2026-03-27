import { Tenant } from '../../../domain/entities/tenant.entity.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

export class GetTenantUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(tenantId: string): Promise<Result<Tenant, DomainError>> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) return err(new DomainError('TENANT_NOT_FOUND', 'Tenant not found.'));
    return ok(tenant);
  }
}
