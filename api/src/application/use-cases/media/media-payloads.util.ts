import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { MediaAssetStatus } from '../../../domain/enums/media-asset-status.enum.js';
import { MediaUrls } from './media-access.service.js';

/**
 * Forma serializada de un archivo. Un solo lugar para que la bandeja, la
 * biblioteca, los webhooks y la API pública cuenten siempre la misma historia.
 *
 * Lo importante: `available` y `status` viajan siempre, incluso cuando el
 * archivo ya se perdió. Una tarjeta que dice "expirado" con nombre y peso es
 * infinitamente mejor que una burbuja rota o un spinner eterno.
 */
export function serializeMediaAsset(asset: MediaAsset, urls: MediaUrls) {
  return {
    id: asset.id,
    kind: asset.kind,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    filename: asset.filename,
    title: asset.title,
    tags: asset.tags,
    inLibrary: asset.inLibrary,
    source: asset.source,
    status: asset.status,
    /** `false` = ni bytes propios ni original vivo en WhatsApp. */
    available: urls.available,
    /** `true` cuando todavía se está bajando a nuestro storage. */
    processing: asset.status === MediaAssetStatus.PENDING,
    /** `true` cuando vive solo en WhatsApp y tiene fecha de vencimiento. */
    temporary: asset.status === MediaAssetStatus.META_ONLY,
    expiresAt: asset.metaExpiresAt,
    url: urls.url,
    thumbnailUrl: urls.thumbnailUrl,
    downloadUrl: urls.downloadUrl,
    urlExpiresAt: urls.expiresAt,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    conversationId: asset.conversationId,
    contactId: asset.contactId,
    phoneNumberId: asset.phoneNumberId,
    createdAt: asset.createdAt,
  };
}

export type SerializedMediaAsset = ReturnType<typeof serializeMediaAsset>;
