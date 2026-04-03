import { BillingRecord } from '../entities/billing-record.entity.js';

export interface BillingRecordRepository {
  create(record: Omit<BillingRecord, 'id' | 'createdAt'>): Promise<BillingRecord>;
  findByTenantId(tenantId: string): Promise<BillingRecord[]>;
}
