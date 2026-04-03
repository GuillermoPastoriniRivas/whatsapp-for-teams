import { BillingRecord } from '../../../domain/entities/billing-record.entity.js';
import { BillingRecordRepository } from '../../../domain/repositories/billing-record.repository.js';

export class GetBillingHistoryUseCase {
  constructor(private readonly billingRecordRepo: BillingRecordRepository) {}

  async execute(tenantId: string): Promise<BillingRecord[]> {
    return this.billingRecordRepo.findByTenantId(tenantId);
  }
}
