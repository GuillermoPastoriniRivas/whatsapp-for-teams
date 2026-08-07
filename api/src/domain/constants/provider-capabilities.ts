import { MessagingProvider } from '../enums/messaging-provider.enum.js';

export interface ProviderCapabilities {
  /**
   * Deja cambiar la foto del perfil. Necesita la API de subida reanudable de
   * Meta, que pide el App ID; el tenant demo no tiene dónde subir los bytes.
   */
  profilePicture: boolean;
}

/**
 * Matriz de capacidades por proveedor. Desde que asis.chat es la capa de
 * provider y habla Meta Cloud API directo, la única diferencia real es contra
 * el proveedor `demo`, que resuelve todo dentro del tenant y no tiene API atrás.
 */
const CAPABILITIES: Record<string, ProviderCapabilities> = {
  [MessagingProvider.META]: { profilePicture: true },
  [MessagingProvider.DEMO]: { profilePicture: false },
};

const NO_CAPABILITIES: ProviderCapabilities = {
  profilePicture: false,
};

export function getProviderCapabilities(provider: string): ProviderCapabilities {
  return CAPABILITIES[provider] ?? NO_CAPABILITIES;
}
