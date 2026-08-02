import { Message } from '../../../domain/entities/message.entity.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MediaAccessService } from './media-access.service.js';
import { serializeMediaAsset, SerializedMediaAsset } from './media-payloads.util.js';

export type MessageWithMedia = Message & { media: SerializedMediaAsset | null };

/**
 * Adjunta el archivo serializado a los mensajes que lo tienen.
 *
 * Va acá y no en el repositorio porque resolver las URLs implica firmar (S3 o
 * proxy), y eso depende del plan del tenant — que es justo lo que el resto de
 * la app no tiene que saber.
 */
export class MessageMediaEnricher {
  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
  ) {}

  async one(message: Message): Promise<MessageWithMedia> {
    const [enriched] = await this.many([message]);
    return enriched;
  }

  async many(messages: Message[]): Promise<MessageWithMedia[]> {
    const assetIds = [...new Set(messages.map((m) => m.mediaAssetId).filter((id): id is string => !!id))];

    if (!assetIds.length) {
      return messages.map((message) => Object.assign(message, { media: null }));
    }

    const assets = await this.assetRepo.findByIds(assetIds);
    const now = new Date();

    const serialized = new Map<string, SerializedMediaAsset>();
    await Promise.all(
      assets.map(async (asset) => {
        serialized.set(asset.id, serializeMediaAsset(asset, await this.mediaAccess.viewUrls(asset, now)));
      }),
    );

    return messages.map((message) =>
      Object.assign(message, {
        media: message.mediaAssetId ? serialized.get(message.mediaAssetId) ?? null : null,
      }),
    );
  }
}
