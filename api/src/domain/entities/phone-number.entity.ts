import { MessagingProvider } from '../enums/messaging-provider.enum.js';
import { PhoneNumberStatus } from '../enums/phone-number-status.enum.js';
import type { WhatsAppBusinessProfile } from './whatsapp-business-profile.entity.js';

/**
 * Salud del número según Meta. No la escribimos nosotros: la alimentan los
 * webhooks de cuenta (`phone_number_quality_update`, `phone_number_name_update`,
 * `account_update`) y la sincronización al registrar el número.
 *
 * Existe para que un número degradado o baneado se vea en la app, en vez de que
 * el primero en enterarse sea el cliente cuando le fallan las campañas.
 */
export interface PhoneNumberHealth {
  /** GREEN | YELLOW | RED | UNKNOWN */
  qualityRating: string | null;
  /** STANDARD | HIGH | NOT_APPLICABLE — cuántos mensajes por segundo admite. */
  throughputLevel: string | null;
  /** APPROVED | REJECTED | PENDING — verificación del nombre para mostrar. */
  nameStatus: string | null;
  /** Baneo o restricción de la WABA, cuando Meta lo informa. */
  accountStatus: string | null;
  /** Último aviso de Meta. Null = nunca llegó ninguno. */
  updatedAt: Date | null;
}

export const EMPTY_PHONE_HEALTH: PhoneNumberHealth = {
  qualityRating: null,
  throughputLevel: null,
  nameStatus: null,
  accountStatus: null,
  updatedAt: null,
};

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
    /**
     * Copia del perfil de negocio que sirve el proveedor. Es caché, no fuente:
     * se refresca en cada lectura y se pisa después de cada escritura exitosa.
     * `null` = todavía no se consultó.
     */
    public readonly businessProfile: WhatsAppBusinessProfile | null = null,
    /** Lo que Meta reporta del número. `null` = todavía no llegó ningún aviso. */
    public readonly health: PhoneNumberHealth | null = null,
  ) {}

  /** Scope con el que se resuelven los BSUID recibidos por este número. */
  get bsuidScope(): string {
    return this.portfolioId ?? this.wabaId;
  }
}
