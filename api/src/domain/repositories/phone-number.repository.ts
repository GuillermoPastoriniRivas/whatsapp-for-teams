import { PhoneNumber } from '../entities/phone-number.entity.js';

export interface PhoneNumberRepository {
  create(phoneNumber: Omit<PhoneNumber, 'id' | 'createdAt' | 'portfolioId' | 'bsuidScope'> & { portfolioId?: string | null }): Promise<PhoneNumber>;
  findById(id: string): Promise<PhoneNumber | null>;
  findByPhoneNumberId(phoneNumberId: string): Promise<PhoneNumber | null>;
  findByWabaId(wabaId: string): Promise<PhoneNumber | null>;
  findByTenantId(tenantId: string): Promise<PhoneNumber[]>;
  update(id: string, data: Partial<Pick<PhoneNumber, 'label' | 'status' | 'webhookSecret' | 'providerConfig' | 'wabaId' | 'phoneNumberId' | 'displayPhone' | 'portfolioId'>>): Promise<PhoneNumber | null>;
  countByTenantId(tenantId: string): Promise<number>;
}
