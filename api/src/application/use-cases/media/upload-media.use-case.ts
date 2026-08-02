import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { MediaAssetStatus } from '../../../domain/enums/media-asset-status.enum.js';
import { MediaKind } from '../../../domain/enums/media-kind.enum.js';
import { MediaSource } from '../../../domain/enums/media-source.enum.js';
import {
  isUnsafeInline,
  kindFromMimeType,
  mediaIdCacheExpiryFrom,
  metaExpiryFrom,
  WHATSAPP_SIZE_LIMITS,
} from '../../../domain/constants/media-constraints.js';
import { resolveMimeType } from '../../../domain/services/mime-sniffer.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MediaProviderRefRepository } from '../../../domain/repositories/media-provider-ref.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import {
  MediaLibraryUnavailableError,
  MediaStorageNotConfiguredError,
  MediaTooLargeError,
  StorageQuotaExceededError,
  UnsupportedMediaTypeError,
} from '../../../domain/errors/media-errors.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { Result, ok, err } from '../../common/result.js';
import { ImageProcessorPort } from '../../ports/image-processor.port.js';
import { MediaProviderPort } from '../../ports/media-provider.port.js';
import { MediaAccessService } from './media-access.service.js';
import { MediaStorageService } from './media-storage.service.js';

export interface UploadMediaInput {
  tenantId: string;
  agentId: string;
  buffer: Buffer;
  declaredMimeType: string | null;
  filename: string | null;
  /** Número por el que se va a enviar. Obligatorio en passthrough. */
  phoneNumberId?: string | null;
  conversationId?: string | null;
  contactId?: string | null;
  source: MediaSource;
  /** Guardarlo en la biblioteca curada además del historial. */
  inLibrary?: boolean;
  title?: string | null;
  tags?: string[];
}

const KIND_LABELS: Record<MediaKind, string> = {
  [MediaKind.IMAGE]: 'imágenes',
  [MediaKind.VIDEO]: 'videos',
  [MediaKind.AUDIO]: 'audios',
  [MediaKind.DOCUMENT]: 'documentos',
  [MediaKind.STICKER]: 'stickers',
};

/**
 * Recibe un archivo del agente y lo deja listo para enviar.
 *
 * Con plan pago se guardan los bytes y el archivo queda disponible para
 * siempre. En passthrough se sube directo a Meta y solo se registra la
 * metadata: a los 30 días el archivo ya no existe.
 */
export class UploadMediaUseCase {
  private readonly logger = new Logger(UploadMediaUseCase.name);

  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly refRepo: MediaProviderRefRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly mediaAccess: MediaAccessService,
    private readonly mediaStorage: MediaStorageService,
    private readonly mediaProvider: MediaProviderPort,
    private readonly images: ImageProcessorPort,
  ) {}

  async execute(input: UploadMediaInput): Promise<Result<MediaAsset, DomainError>> {
    // Los bytes mandan sobre lo que declara el cliente: un archivo que dice ser
    // JPEG y en realidad es HTML sería XSS almacenado.
    let mimeType = resolveMimeType(input.buffer, input.declaredMimeType, input.filename);
    let buffer = input.buffer;

    if (isUnsafeInline(mimeType)) {
      return err(new UnsupportedMediaTypeError(mimeType));
    }

    let kind = kindFromMimeType(mimeType);

    // Una foto grande o en un formato raro se arregla sola antes de fallar
    // contra Meta con un código numérico que nadie entiende.
    if (!kind && mimeType.startsWith('image/')) {
      const normalized = await this.normalizeImage(buffer, mimeType);
      if (!normalized) return err(new UnsupportedMediaTypeError(mimeType));
      buffer = normalized.buffer;
      mimeType = normalized.mimeType;
      kind = kindFromMimeType(mimeType);
    }

    if (!kind) return err(new UnsupportedMediaTypeError(mimeType));

    if (kind === MediaKind.IMAGE && buffer.byteLength > WHATSAPP_SIZE_LIMITS[MediaKind.IMAGE]) {
      const normalized = await this.normalizeImage(buffer, mimeType);
      if (normalized) {
        buffer = normalized.buffer;
        mimeType = normalized.mimeType;
      }
    }

    const limit = WHATSAPP_SIZE_LIMITS[kind];
    if (buffer.byteLength > limit) {
      return err(new MediaTooLargeError(buffer.byteLength, limit, KIND_LABELS[kind]));
    }

    const now = new Date();
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    // Ya lo tenemos: no hace falta volver a guardarlo ni volver a subirlo.
    const reusable = await this.assetRepo.findReusableBySha256(input.tenantId, sha256, now);
    if (reusable) {
      await this.promoteToLibraryIfNeeded(reusable, input);
      return ok(reusable);
    }

    const capabilities = await this.mediaAccess.capabilities(input.tenantId);
    const hasStorage = capabilities.enabled;

    if (input.inLibrary && !hasStorage) {
      // Dos causas distintas, dos mensajes distintos: al cliente Business en un
      // entorno sin bucket no se le puede pedir que actualice el plan.
      return err(
        capabilities.planIncludesLibrary
          ? new MediaStorageNotConfiguredError()
          : new MediaLibraryUnavailableError(),
      );
    }

    return hasStorage
      ? this.storeAndRegister({ ...input, buffer }, mimeType, kind, now)
      : this.passthroughUpload({ ...input, buffer }, mimeType, kind, sha256, now);
  }

  private async normalizeImage(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
      return await this.images.normalizeForWhatsApp(buffer, mimeType);
    } catch (error: any) {
      this.logger.warn(`No se pudo normalizar la imagen (${mimeType}): ${error?.message}`);
      return null;
    }
  }

  // ── Plan pago: los bytes son nuestros ───────────────────

  private async storeAndRegister(
    input: UploadMediaInput,
    mimeType: string,
    kind: MediaKind,
    now: Date,
  ): Promise<Result<MediaAsset, DomainError>> {
    const quota = await this.checkQuota(input.tenantId, input.buffer.byteLength);
    if (quota) return err(quota);

    const stored = await this.mediaStorage.store({
      tenantId: input.tenantId,
      buffer: input.buffer,
      mimeType,
      kind,
      filename: input.filename,
    });

    const limits = await this.mediaAccess.planFor(input.tenantId);

    const asset = await this.assetRepo.create({
      tenantId: input.tenantId,
      kind,
      mimeType,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      filename: input.filename,
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      source: input.source,
      phoneNumberId: input.phoneNumberId ?? null,
      conversationId: input.conversationId ?? null,
      contactId: input.contactId ?? null,
      uploadedByAgentId: input.agentId,
      status: MediaAssetStatus.READY,
      expiresAt: this.mediaStorage.retentionExpiry(limits, now),
      inLibrary: input.inLibrary ?? false,
      title: input.title ?? null,
      tags: input.tags ?? [],
      width: stored.width,
      height: stored.height,
    });

    await this.assetRepo.update(asset.id, { derivatives: stored.derivatives });
    return ok((await this.assetRepo.findById(asset.id))!);
  }

  /**
   * La cuota solo frena los uploads salientes. La ingesta de lo que mandan los
   * clientes nunca se bloquea: no se le puede decir a un negocio "no guardamos
   * la foto que te mandó tu cliente".
   */
  private async checkQuota(tenantId: string, incomingBytes: number): Promise<DomainError | null> {
    const limits = await this.mediaAccess.planFor(tenantId);
    if (limits.storageBytes <= 0) return null; // -1 = sin tope

    const usage = await this.assetRepo.usageSummary(tenantId, new Date());
    if (usage.storedBytes + incomingBytes <= limits.storageBytes) return null;

    return new StorageQuotaExceededError(usage.storedBytes, limits.storageBytes);
  }

  // ── Passthrough: los bytes van directo a Meta ───────────

  private async passthroughUpload(
    input: UploadMediaInput,
    mimeType: string,
    kind: MediaKind,
    sha256: string,
    now: Date,
  ): Promise<Result<MediaAsset, DomainError>> {
    if (!input.phoneNumberId) {
      return err(
        new DomainError(
          'PHONE_NUMBER_REQUIRED',
          'Sin biblioteca hay que subir el archivo desde una conversación: es el número el que lo aloja en WhatsApp.',
        ),
      );
    }

    const phone = await this.phoneRepo.findById(input.phoneNumberId);
    if (!phone) {
      return err(new DomainError('PHONE_NUMBER_NOT_FOUND', 'El número de teléfono no existe.'));
    }

    const uploaded = await this.mediaProvider.upload({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      buffer: input.buffer,
      mimeType,
      filename: input.filename ?? `archivo.${mimeType.split('/')[1] ?? 'bin'}`,
    });

    const asset = await this.assetRepo.create({
      tenantId: input.tenantId,
      kind,
      mimeType,
      sizeBytes: input.buffer.byteLength,
      sha256,
      filename: input.filename,
      metaMediaId: uploaded.providerMediaId,
      metaExpiresAt: metaExpiryFrom(now),
      source: input.source,
      phoneNumberId: phone.id,
      conversationId: input.conversationId ?? null,
      contactId: input.contactId ?? null,
      uploadedByAgentId: input.agentId,
      status: MediaAssetStatus.META_ONLY,
    });

    // El id ya está: cachearlo evita que el envío vuelva a bajar y subir.
    await this.refRepo.upsert({
      assetId: asset.id,
      phoneNumberId: phone.id,
      providerMediaId: uploaded.providerMediaId,
      expiresAt: mediaIdCacheExpiryFrom(now),
    });

    return ok(asset);
  }

  private async promoteToLibraryIfNeeded(
    asset: MediaAsset,
    input: UploadMediaInput,
  ): Promise<void> {
    if (!input.inLibrary || asset.inLibrary) return;
    await this.assetRepo.update(asset.id, {
      inLibrary: true,
      title: input.title ?? asset.title,
      tags: input.tags?.length ? input.tags : asset.tags,
    });
  }
}
