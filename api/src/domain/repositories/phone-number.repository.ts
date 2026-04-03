import { PhoneNumber } from '../entities/phone-number.entity.js';

export interface PhoneNumberRepository {
  create(phoneNumber: Omit<PhoneNumber, 'id' | 'createdAt'>): Promise<PhoneNumber>;
  findById(id: string): Promise<PhoneNumber | null>;
  findByPhoneNumberId(phoneNumberId: string): Promise<PhoneNumber | null>;
  findByTenantId(tenantId: string): Promise<PhoneNumber[]>;
  update(id: string, data: Partial<Pick<PhoneNumber, 'label' | 'status' | 'webhookSecret' | 'providerConfig' | 'wabaId' | 'phoneNumberId' | 'displayPhone'>>): Promise<PhoneNumber | null>;
  countByTenantId(tenantId: string): Promise<number>;
}
