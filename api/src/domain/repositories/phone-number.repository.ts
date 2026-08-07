import { PhoneNumber } from '../entities/phone-number.entity.js';

export interface PhoneNumberRepository {
  create(
    phoneNumber: Omit<PhoneNumber, 'id' | 'createdAt' | 'portfolioId' | 'bsuidScope' | 'businessProfile' | 'health'> & {
      portfolioId?: string | null;
    },
  ): Promise<PhoneNumber>;
  findById(id: string): Promise<PhoneNumber | null>;
  findByPhoneNumberId(phoneNumberId: string): Promise<PhoneNumber | null>;
  findByWabaId(wabaId: string): Promise<PhoneNumber | null>;
  /** Todos los números de una WABA: los eventos de cuenta aplican a todos. */
  findAllByWabaId(wabaId: string): Promise<PhoneNumber[]>;
  findByTenantId(tenantId: string): Promise<PhoneNumber[]>;
  update(id: string, data: Partial<Pick<PhoneNumber, 'label' | 'status' | 'webhookSecret' | 'providerConfig' | 'wabaId' | 'phoneNumberId' | 'displayPhone' | 'portfolioId' | 'businessProfile' | 'health'>>): Promise<PhoneNumber | null>;
  countByTenantId(tenantId: string): Promise<number>;
}
