import { MessagingProvider } from '../enums/messaging-provider.enum.js';

export interface ProviderCapabilities {
  /** Puede enviar mensajes interactivos (botones/listas) reales */
  interactive: boolean;
  /** Puede enviar plantillas aprobadas */
  templates: boolean;
}

/**
 * Matriz de capacidades por proveedor. Los nodos de flujo la consultan para
 * degradar con gracia (p. ej. botones → menú numerado de texto en Twilio) o
 * bloquear en la validación de publicación (plantillas en Twilio).
 */
const CAPABILITIES: Record<string, ProviderCapabilities> = {
  [MessagingProvider.META]: { interactive: true, templates: true },
  [MessagingProvider.KAPSO]: { interactive: true, templates: true },
  [MessagingProvider.TWILIO]: { interactive: false, templates: false },
  [MessagingProvider.DIALOG_360]: { interactive: false, templates: false },
  [MessagingProvider.DEMO]: { interactive: true, templates: true },
};

export function getProviderCapabilities(provider: string): ProviderCapabilities {
  return CAPABILITIES[provider] ?? { interactive: false, templates: false };
}
