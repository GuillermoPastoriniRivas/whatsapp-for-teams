import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import type { WhatsAppBusinessProfile } from '../../domain/entities/whatsapp-business-profile.entity.js';

export interface BusinessProfileContext {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  /** Id del número en el proveedor (no el `_id` nuestro). */
  phoneNumberId: string;
}

/** Campos escribibles. `undefined` = no tocar; `null` = vaciar. */
export interface BusinessProfileUpdate {
  about?: string | null;
  address?: string | null;
  description?: string | null;
  email?: string | null;
  vertical?: string | null;
  websites?: string[];
  /** Handle devuelto por `uploadProfilePicture`. */
  profilePictureHandle?: string;
}

/**
 * Lectura y escritura del perfil de negocio contra el proveedor. Cada
 * implementación habla con su API; la estrategia elige según el proveedor del
 * número.
 */
export interface BusinessProfilePort {
  /**
   * `null` cuando el proveedor no guarda un perfil propio (el demo): ahí manda
   * la copia que tenemos nosotros, que pasa a ser la fuente.
   */
  getProfile(ctx: BusinessProfileContext): Promise<WhatsAppBusinessProfile | null>;
  updateProfile(ctx: BusinessProfileContext, update: BusinessProfileUpdate): Promise<void>;
  /**
   * Sube la imagen y devuelve el handle que entiende `profilePictureHandle`.
   * Tira si el proveedor no lo soporta.
   */
  uploadProfilePicture(ctx: BusinessProfileContext, file: Buffer, mimeType: string): Promise<string>;
}
