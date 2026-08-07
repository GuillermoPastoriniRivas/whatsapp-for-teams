import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

/** Credenciales + identidad del número contra el que se opera. */
export interface PhoneAdminContext {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
}

/**
 * Componentes conversacionales: lo que el cliente ve *antes* de escribir.
 *
 * Límites de Meta, validados antes de gastar el viaje a la API: hasta 4 ice
 * breakers de 80 caracteres y hasta 30 comandos (32 el nombre, 256 el hint).
 * Ninguno de los dos acepta emojis.
 */
export interface ConversationalComponents {
  iceBreakers: string[];
  commands: Array<{ commandName: string; commandDescription: string }>;
  /** Meta lo expone como `enable_welcome_message` en algunas versiones. */
  enabled: boolean;
}

/** Lo que Meta sabe del número, más allá de nuestras credenciales. */
export interface RemotePhoneNumberInfo {
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  /** GREEN | YELLOW | RED | UNKNOWN */
  qualityRating: string | null;
  /** VERIFIED | NOT_VERIFIED | EXPIRED */
  codeVerificationStatus: string | null;
  /** STANDARD | HIGH | NOT_APPLICABLE */
  throughputLevel: string | null;
  /** El número está registrado en Cloud API y puede mandar mensajes. */
  registered: boolean;
}

export interface BlockedUser {
  waId: string;
}

/**
 * Administración del número contra la API del proveedor: componentes
 * conversacionales, registro en Cloud API y lista de bloqueados.
 *
 * Va aparte de `MessagingApiPort` (que manda mensajes) y de
 * `BusinessProfilePort` (que edita el perfil visible) porque son operaciones de
 * cuenta, no de conversación.
 */
export interface PhoneAdminPort {
  getConversationalComponents(ctx: PhoneAdminContext): Promise<ConversationalComponents | null>;
  updateConversationalComponents(ctx: PhoneAdminContext, components: ConversationalComponents): Promise<void>;

  /** Lee lo que Meta reporta del número (nombre, calidad, verificación). */
  getPhoneNumberInfo(ctx: PhoneAdminContext): Promise<RemotePhoneNumberInfo | null>;
  /**
   * Registra el número en Cloud API con un PIN de 2FA de 6 dígitos. Sin esto el
   * número no manda nada, por más que las credenciales sean correctas.
   */
  register(ctx: PhoneAdminContext, pin: string): Promise<void>;
  deregister(ctx: PhoneAdminContext): Promise<void>;
  /** Pide a Meta que mande el código de verificación del PIN por SMS o voz. */
  requestVerificationCode(ctx: PhoneAdminContext, method: 'SMS' | 'VOICE', locale?: string): Promise<void>;
  verifyCode(ctx: PhoneAdminContext, code: string): Promise<void>;

  listBlockedUsers(ctx: PhoneAdminContext): Promise<BlockedUser[]>;
  blockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void>;
  unblockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void>;
}
