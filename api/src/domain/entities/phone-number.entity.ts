import { MessagingProvider } from '../enums/messaging-provider.enum.js';
import { PhoneNumberStatus } from '../enums/phone-number-status.enum.js';

export class PhoneNumber {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly provider: MessagingProvider,
    public readonly providerConfig: Record<string, string>,
    public readonly wabaId: string,
    public readonly phoneNumberId: string,
    public readonly displayPhone: string,
    public readonly label: string,
    public readonly webhookSecret: string,
    public readonly status: PhoneNumberStatus,
    public readonly createdAt: Date,
  ) {}
}
