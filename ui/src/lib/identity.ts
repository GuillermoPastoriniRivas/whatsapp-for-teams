/**
 * Identidad visible de un contacto de WhatsApp.
 *
 * Desde el rollout de usernames el teléfono puede no existir, así que ningún
 * componente debería concatenar `+` con un campo suelto: si el número falta,
 * eso pinta un `+undefined`. Toda la cadena de fallback vive acá.
 */

export interface ContactIdentity {
  name?: string | null;
  phone?: string | null;
  username?: string | null;
  bsuid?: string | null;
}

/** Teléfono con '+', o null si el contacto no lo compartió. */
export function formatPhone(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

/**
 * Cómo se identifica al contacto cuando no hay nombre: primero el username,
 * después el teléfono, y recién al final una forma corta del BSUID —que no le
 * dice nada a un agente, pero distingue una fila de otra.
 */
export function identityHandle(contact: ContactIdentity): string | null {
  if (contact.username) return `@${contact.username}`;
  const phone = formatPhone(contact.phone);
  if (phone) return phone;
  if (contact.bsuid) return shortBsuid(contact.bsuid);
  return null;
}

/** Etiqueta principal: el nombre si lo hay, si no el identificador disponible. */
export function displayIdentity(contact: ContactIdentity | null | undefined, fallback = "—"): string {
  if (!contact) return fallback;
  if (contact.name?.trim()) return contact.name.trim();
  return identityHandle(contact) ?? fallback;
}

/**
 * Línea secundaria (bajo el nombre). Devuelve null cuando coincide con la
 * etiqueta principal, para no repetir el mismo dato dos veces.
 */
export function identitySubtitle(contact: ContactIdentity | null | undefined): string | null {
  if (!contact) return null;
  const handle = identityHandle(contact);
  if (!handle) return null;
  return contact.name?.trim() ? handle : null;
}

/**
 * `US.13491208655302741918` → `US · 1349…1918`. Se conserva el país porque es
 * lo único legible, y las puntas para poder cotejarlo contra un log.
 */
export function shortBsuid(bsuid: string): string {
  const [country, ...rest] = bsuid.split(".");
  const id = rest.join(".");
  if (id.length <= 12) return `${country} · ${id}`;
  return `${country} · ${id.slice(0, 4)}…${id.slice(-4)}`;
}
