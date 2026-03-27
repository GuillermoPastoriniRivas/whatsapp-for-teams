import { MessagingProvider } from '../../../domain/enums/messaging-provider.enum.js';

export interface RegisterPhoneNumberInput {
  tenantId: string;
  provider: MessagingProvider;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  label: string;
  webhookSecret: string;
}
