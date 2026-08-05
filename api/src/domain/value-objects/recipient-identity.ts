import { Contact } from '../entities/contact.entity.js';

/**
 * Destino de un envío, en los términos que espera la Cloud API.
 *
 * Meta acepta los dos campos a la vez y le da **precedencia a `to`**, así que
 * cuando conocemos ambos mandamos ambos: si el teléfono se volvió inválido, el
 * BSUID queda como respaldo del lado de Meta.
 */
export interface RecipientIdentity {
  /** Teléfono en dígitos, sin '+'. */
  to?: string;
  /** Business-Scoped User ID. */
  recipient?: string;
}

/** `CC.alfanumérico` o `CC.ENT.alfanumérico`, hasta 128 chars tras el prefijo. */
const BSUID_PATTERN = /^[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}$/;

export function isBsuid(value: string): boolean {
  return BSUID_PATTERN.test(value);
}

export function recipientIdentityOf(
  contact: Pick<Contact, 'phone' | 'bsuid'>,
): RecipientIdentity {
  return {
    ...(contact.phone ? { to: contact.phone } : {}),
    ...(contact.bsuid ? { recipient: contact.bsuid } : {}),
  };
}

/** Sin ninguno de los dos ejes no hay a dónde mandar. */
export function isRoutable(identity: RecipientIdentity): boolean {
  return Boolean(identity.to ?? identity.recipient);
}

/**
 * Solo-BSUID. Dos consecuencias: exige un proveedor que soporte `recipient`, y
 * Meta rechaza las plantillas de autenticación one-tap/zero-tap/copy-code con
 * el error 131062 — ésas necesitan sí o sí el teléfono.
 */
export function isBsuidOnly(identity: RecipientIdentity): boolean {
  return !identity.to && Boolean(identity.recipient);
}

/**
 * Plantillas que Meta se niega a entregar a un BSUID (error 131062).
 *
 * La regla oficial habla de las de autenticación one-tap, zero-tap y copy-code.
 * Meta exige que **toda** plantilla de autenticación lleve uno de esos botones
 * OTP, así que la categoría alcanza como criterio — y además es lo único que
 * podemos evaluar: el tipo `OTP` no viaja en los componentes que guardamos.
 */
export function templateRequiresPhone(category: string): boolean {
  return category === 'authentication';
}

/** Etiqueta corta para logs y errores, sin volcar el identificador completo. */
export function describeRecipient(identity: RecipientIdentity): string {
  if (identity.to) return identity.to;
  if (identity.recipient) return `bsuid:${identity.recipient.slice(0, 12)}…`;
  return 'unknown';
}
