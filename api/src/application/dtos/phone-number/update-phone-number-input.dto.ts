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
  /**
   * Portfolio de negocio que scopea los BSUID. Null o vacío ⇒ se usa `wabaId`.
   * Solo hace falta cuando el portfolio agrupa varias WABAs: sin esto, la misma
   * persona entra como dos contactos distintos según por qué línea escriba.
   */
  portfolioId?: string | null;
}
