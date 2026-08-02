import { MediaAsset } from '../../../../domain/entities/media-asset.entity.js';
import { MediaAssetStatus } from '../../../../domain/enums/media-asset-status.enum.js';
import { MediaKind } from '../../../../domain/enums/media-kind.enum.js';
import { MediaSource } from '../../../../domain/enums/media-source.enum.js';
import { MediaAssetDocument } from '../schemas/media-asset.schema.js';

export class MediaAssetMapper {
  static toDomain(doc: MediaAssetDocument): MediaAsset {
    return new MediaAsset(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.kind as MediaKind,
      doc.mimeType,
      doc.sizeBytes,
      doc.sha256 ?? null,
      doc.filename ?? null,
      doc.storageKey ?? null,
      doc.storageProvider ?? null,
      doc.derivatives ?? [],
      doc.metaMediaId ?? null,
      doc.metaExpiresAt ?? null,
      doc.backfilledAt ?? null,
      doc.source as MediaSource,
      doc.phoneNumberId?.toHexString() ?? null,
      doc.conversationId?.toHexString() ?? null,
      doc.contactId?.toHexString() ?? null,
      doc.messageId?.toHexString() ?? null,
      doc.uploadedByAgentId ?? null,
      doc.status as MediaAssetStatus,
      doc.failureReason ?? null,
      doc.expiresAt ?? null,
      doc.deletedAt ?? null,
      doc.inLibrary ?? false,
      doc.title ?? null,
      doc.tags ?? [],
      doc.width ?? null,
      doc.height ?? null,
      doc.durationMs ?? null,
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
