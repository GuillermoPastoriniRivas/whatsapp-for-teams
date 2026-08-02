import { SendMessageParams } from '../../application/ports/messaging-api.port.js';

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

/**
 * Arma el objeto de media del Cloud API (`image`, `document`, …).
 *
 * Prioriza `mediaId` sobre `mediaUrl`: subir los bytes y mandar el id evita
 * exponer una URL pública y saca del medio todos los fallos de "Meta no pudo
 * descargar tu link" (timeout, TLS, Content-Type mal seteado).
 *
 * Devuelve `null` si el mensaje no es de media o no trae ninguna referencia.
 */
export function buildMediaPayload(
  params: SendMessageParams,
): Record<string, string> | null {
  if (!MEDIA_TYPES.has(params.type)) return null;
  if (!params.mediaId && !params.mediaUrl) return null;

  const media: Record<string, string> = params.mediaId
    ? { id: params.mediaId }
    : { link: params.mediaUrl! };

  // Ni el audio ni los stickers admiten caption en el Cloud API.
  if (params.body && params.type !== 'audio' && params.type !== 'sticker') {
    media.caption = params.body;
  }
  if (params.filename && params.type === 'document') {
    media.filename = params.filename;
  }

  return media;
}
