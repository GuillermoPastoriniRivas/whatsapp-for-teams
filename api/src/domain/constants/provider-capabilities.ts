import { MessagingProvider } from '../enums/messaging-provider.enum.js';

export interface ProviderCapabilities {
  /** Puede enviar mensajes interactivos (botones/listas) reales */
  interactive: boolean;
  /** Puede enviar plantillas aprobadas */
  templates: boolean;
  /** Acepta el campo `recipient` para direccionar por BSUID en vez de teléfono */
  bsuid: boolean;
  /** Expone el perfil de negocio del número (about, dirección, rubro…) */
  businessProfile: boolean;
  /**
   * Deja cambiar la foto del perfil. Necesita la API de subida reanudable de
   * Meta, que pide el App ID; por eso va aparte de `businessProfile`.
   */
  profilePicture: boolean;
}

/**
 * Matriz de capacidades por proveedor. Los nodos de flujo la consultan para
 * degradar con gracia (p. ej. botones → menú numerado de texto en Twilio) o
 * bloquear en la validación de publicación (plantillas en Twilio).
 */
const CAPABILITIES: Record<string, ProviderCapabilities> = {
  [MessagingProvider.META]: { interactive: true, templates: true, bsuid: true, businessProfile: true, profilePicture: true },
  [MessagingProvider.KAPSO]: { interactive: true, templates: true, bsuid: true, businessProfile: true, profilePicture: true },
  [MessagingProvider.TWILIO]: { interactive: false, templates: false, bsuid: false, businessProfile: false, profilePicture: false },
  [MessagingProvider.DIALOG_360]: { interactive: false, templates: false, bsuid: false, businessProfile: false, profilePicture: false },
  // El demo guarda el perfil en su propia copia; la foto necesitaría subirla a
  // algún lado real, así que ahí queda fuera.
  [MessagingProvider.DEMO]: { interactive: true, templates: true, bsuid: true, businessProfile: true, profilePicture: false },
};

const NO_CAPABILITIES: ProviderCapabilities = {
  interactive: false,
  templates: false,
  bsuid: false,
  businessProfile: false,
  profilePicture: false,
};

export function getProviderCapabilities(provider: string): ProviderCapabilities {
  return CAPABILITIES[provider] ?? NO_CAPABILITIES;
}
