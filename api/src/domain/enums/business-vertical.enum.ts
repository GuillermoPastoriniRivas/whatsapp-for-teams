/**
 * Rubros que acepta el campo `vertical` del perfil de negocio de WhatsApp.
 * Los valores son los de Meta y viajan tal cual: no se traducen ni se
 * normalizan (la traducción para el usuario vive en la UI).
 *
 * OJO: no confundir con `BusinessVertical` de los asistentes de IA, que son
 * cuatro rubros nuestros para armar el prompt. Son dos cosas distintas.
 */
export const BUSINESS_VERTICALS = [
  'UNDEFINED',
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
  'NOT_A_BIZ',
] as const;

export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number];

export function isBusinessVertical(value: unknown): value is BusinessVertical {
  return typeof value === 'string' && (BUSINESS_VERTICALS as readonly string[]).includes(value);
}
