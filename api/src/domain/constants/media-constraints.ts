import { MediaKind } from '../enums/media-kind.enum.js';

/**
 * Lo que el Cloud API de WhatsApp acepta de verdad. Todo lo que no esté acá se
 * rechaza en el upload con un mensaje que se entienda, en vez de dejar que Meta
 * lo tire abajo con un código numérico cuando el agente ya apretó enviar.
 *
 * Referencia: developers.facebook.com/docs/whatsapp/cloud-api/reference/media
 */
export const WHATSAPP_MIME_TYPES: Record<MediaKind, readonly string[]> = {
  [MediaKind.IMAGE]: ['image/jpeg', 'image/png'],
  [MediaKind.VIDEO]: ['video/mp4', 'video/3gp', 'video/3gpp'],
  [MediaKind.AUDIO]: [
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/amr',
    'audio/ogg',
  ],
  [MediaKind.DOCUMENT]: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  [MediaKind.STICKER]: ['image/webp'],
};

/** Tope de tamaño por tipo, en bytes. */
export const WHATSAPP_SIZE_LIMITS: Record<MediaKind, number> = {
  [MediaKind.IMAGE]: 5 * 1024 * 1024,
  [MediaKind.VIDEO]: 16 * 1024 * 1024,
  [MediaKind.AUDIO]: 16 * 1024 * 1024,
  [MediaKind.DOCUMENT]: 100 * 1024 * 1024,
  [MediaKind.STICKER]: 500 * 1024,
};

/** El tope absoluto que aceptamos en un upload, sea del tipo que sea. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * MIME types que jamás servimos con su Content-Type real: un SVG o un HTML
 * subido por un tercero es XSS almacenado. Se fuerzan a descarga binaria.
 */
export const UNSAFE_INLINE_MIME_TYPES: readonly string[] = [
  'image/svg+xml',
  'text/html',
  'text/xml',
  'application/xml',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
];

const MIME_TO_KIND: Record<string, MediaKind> = Object.entries(WHATSAPP_MIME_TYPES)
  .flatMap(([kind, mimes]) => mimes.map((mime) => [mime, kind as MediaKind] as const))
  .reduce<Record<string, MediaKind>>((acc, [mime, kind]) => {
    // 'image/webp' cae en sticker; el resto es unívoco.
    acc[mime] = kind;
    return acc;
  }, {});

/** Deduce el tipo de WhatsApp a partir del MIME. `null` si no está soportado. */
export function kindFromMimeType(mimeType: string): MediaKind | null {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_TO_KIND[normalized] ?? null;
}

export function isSupportedMimeType(mimeType: string): boolean {
  return kindFromMimeType(mimeType) !== null;
}

export function isUnsafeInline(mimeType: string): boolean {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  return UNSAFE_INLINE_MIME_TYPES.includes(normalized);
}

/** Meta retiene el media 30 días desde que se recibe o se sube. */
export const META_MEDIA_RETENTION_DAYS = 30;

/**
 * Los `media_id` de Meta viven 30 días; cacheamos 25 para tener margen y no
 * mandar un id vencido justo en el borde.
 */
export const MEDIA_ID_CACHE_DAYS = 25;

export function metaExpiryFrom(date: Date): Date {
  return new Date(date.getTime() + META_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function mediaIdCacheExpiryFrom(date: Date): Date {
  return new Date(date.getTime() + MEDIA_ID_CACHE_DAYS * 24 * 60 * 60 * 1000);
}
