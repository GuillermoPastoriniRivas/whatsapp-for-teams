import { RecipientIdentity } from '../../domain/value-objects/recipient-identity.js';

/**
 * Traduce la identidad del destinatario a los campos que espera la Cloud API.
 *
 * Se mandan los dos cuando los tenemos: Meta le da precedencia a `to`, y dejar
 * el `recipient` puesto sirve de respaldo si el teléfono quedó viejo.
 */
export function addressee(identity: RecipientIdentity): Record<string, string> {
  return {
    ...(identity.to ? { to: identity.to } : {}),
    ...(identity.recipient ? { recipient: identity.recipient } : {}),
  };
}
