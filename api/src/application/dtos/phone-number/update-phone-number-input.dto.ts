import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';

export interface UpdatePhoneNumberInput {
  id: string;
  tenantId: string;
  label?: string;
  status?: PhoneNumberStatus;
  webhookSecret?: string;
  providerConfig?: Record<string, string>;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhone?: string;
}
