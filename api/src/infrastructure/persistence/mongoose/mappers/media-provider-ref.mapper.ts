import { MediaProviderRef } from '../../../../domain/entities/media-provider-ref.entity.js';
import { MediaProviderRefDocument } from '../schemas/media-provider-ref.schema.js';

export class MediaProviderRefMapper {
  static toDomain(doc: MediaProviderRefDocument): MediaProviderRef {
    return new MediaProviderRef(
      doc._id.toHexString(),
      doc.assetId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.providerMediaId,
      doc.expiresAt,
      doc.createdAt,
    );
  }
}
