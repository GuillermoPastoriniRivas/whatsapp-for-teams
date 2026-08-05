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
    /**
     * Portfolio de negocio bajo el que Meta emite los BSUID de este número.
     * Un portfolio puede agrupar varias WABAs, así que no siempre coincide con
     * `wabaId`; cuando no se conoce se usa `wabaId`, que parte de más pero
     * nunca fusiona contactos de portfolios distintos.
     */
    public readonly portfolioId: string | null = null,
  ) {}

  /** Scope con el que se resuelven los BSUID recibidos por este número. */
  get bsuidScope(): string {
    return this.portfolioId ?? this.wabaId;
  }
}
