import { Logger } from '@nestjs/common';
import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { MediaAssetStatus } from '../../../domain/enums/media-asset-status.enum.js';
import { MediaKind } from '../../../domain/enums/media-kind.enum.js';
import { MediaSource } from '../../../domain/enums/media-source.enum.js';
import { kindFromMimeType, metaExpiryFrom } from '../../../domain/constants/media-constraints.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { MediaAccessService } from './media-access.service.js';

export const MEDIA_INGEST_JOB = 'media.ingest';

export interface RegisterInboundMediaInput {
  tenantId: string;
  messageId: string;
  messageType: string;
  phoneNumberId: string;
  conversationId: string;
  contactId: string;
  mediaId: string;
  mimeType?: string;
  filename?: string;
  sha256?: string;
  receivedAt: Date;
}

/**
 * Crea el registro del archivo que llegó por webhook.
 *
 * Nunca baja nada acá: el webhook tiene que devolver 200 rápido y la URL
 * firmada de Meta vive 5 minutos. Con storage, la bajada va por su propio job.
 */
export class RegisterInboundMediaUseCase {
  private readonly logger = new Logger(RegisterInboundMediaUseCase.name);

  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly messageRepo: MessageRepository,
    private readonly mediaAccess: MediaAccessService,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(input: RegisterInboundMediaInput): Promise<MediaAsset | null> {
    // Los webhooks de Meta se reintentan: si el mensaje ya tiene asset, listo.
    const existing = await this.assetRepo.findByMessageId(input.messageId);
    if (existing) return existing;

    const mimeType = input.mimeType ?? 'application/octet-stream';
    const kind = kindFromMimeType(mimeType) ?? this.kindFromMessageType(input.messageType);

    const asset = await this.assetRepo.create({
      tenantId: input.tenantId,
      kind,
      mimeType,
      // El tamaño real llega al bajarlo; en passthrough queda en 0 y la UI
      // muestra el archivo sin peso, que es preferible a mentir.
      sizeBytes: 0,
      sha256: input.sha256 ?? null,
      filename: input.filename ?? null,
      metaMediaId: input.mediaId,
      metaExpiresAt: metaExpiryFrom(input.receivedAt),
      source: MediaSource.INBOUND,
      phoneNumberId: input.phoneNumberId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      messageId: input.messageId,
      status: MediaAssetStatus.META_ONLY,
    });

    await this.messageRepo.attachMediaAsset(input.messageId, asset.id);

    if (await this.mediaAccess.hasStorage(input.tenantId)) {
      await this.jobQueue.enqueue(MEDIA_INGEST_JOB, { assetId: asset.id });
    }

    return asset;
  }

  private kindFromMessageType(messageType: string): MediaKind {
    switch (messageType) {
      case 'image':
        return MediaKind.IMAGE;
      case 'video':
        return MediaKind.VIDEO;
      case 'audio':
        return MediaKind.AUDIO;
      case 'sticker':
        return MediaKind.STICKER;
      default:
        return MediaKind.DOCUMENT;
    }
  }
}
