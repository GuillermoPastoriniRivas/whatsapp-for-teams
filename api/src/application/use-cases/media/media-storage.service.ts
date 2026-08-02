import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { MediaAsset, MediaDerivative } from '../../../domain/entities/media-asset.entity.js';
import { MediaKind } from '../../../domain/enums/media-kind.enum.js';
import { PlanLimits } from '../../../domain/constants/plan-limits.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { ImageProcessorPort } from '../../ports/image-processor.port.js';
import { StoragePort } from '../../ports/storage.port.js';

export interface StoreMediaInput {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
  kind: MediaKind;
  filename: string | null;
}

export interface StoredMedia {
  storageKey: string;
  storageProvider: string;
  sha256: string;
  sizeBytes: number;
  derivatives: MediaDerivative[];
  width: number | null;
  height: number | null;
  /** El contenido ya estaba guardado: se reusó la copia existente. */
  deduplicated: boolean;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'application/pdf': 'pdf',
};

/**
 * Escribe bytes en el storage y arma sus derivados.
 *
 * Es el camino común de la ingesta entrante y del upload del agente, así que
 * la deduplicación por contenido vale para los dos: el mismo catálogo PDF
 * mandado a 10.000 contactos ocupa un solo objeto.
 */
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(
    private readonly storage: StoragePort,
    private readonly images: ImageProcessorPort,
    private readonly assetRepo: MediaAssetRepository,
  ) {}

  async store(input: StoreMediaInput): Promise<StoredMedia> {
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    const existing = await this.assetRepo.findStoredBySha256(input.tenantId, sha256);
    if (existing?.storageKey) {
      return {
        storageKey: existing.storageKey,
        storageProvider: existing.storageProvider ?? this.storage.provider,
        sha256,
        sizeBytes: existing.sizeBytes || input.buffer.byteLength,
        derivatives: existing.derivatives,
        width: existing.width,
        height: existing.height,
        deduplicated: true,
      };
    }

    const storageKey = this.buildKey(input.tenantId, sha256, input.mimeType);

    await this.storage.put({
      key: storageKey,
      body: input.buffer,
      contentType: input.mimeType,
      metadata: { tenant: input.tenantId, sha256 },
    });

    const { derivatives, width, height } = await this.buildDerivatives(input, sha256);

    return {
      storageKey,
      storageProvider: this.storage.provider,
      sha256,
      sizeBytes: input.buffer.byteLength,
      derivatives,
      width,
      height,
      deduplicated: false,
    };
  }

  private async buildDerivatives(
    input: StoreMediaInput,
    sha256: string,
  ): Promise<{ derivatives: MediaDerivative[]; width: number | null; height: number | null }> {
    if (input.kind !== MediaKind.IMAGE && input.kind !== MediaKind.STICKER) {
      return { derivatives: [], width: null, height: null };
    }

    const { width, height } = await this.images.dimensions(input.buffer);
    const derivatives: MediaDerivative[] = [];

    // Servir 20 KB en la grilla en vez del original de 3 MB es lo que mantiene
    // el egress bajo control.
    for (const thumb of await this.images.thumbnails(input.buffer)) {
      const key = `${this.prefix(input.tenantId, sha256)}/${thumb.kind}.webp`;
      await this.storage.put({ key, body: thumb.buffer, contentType: thumb.mimeType });
      derivatives.push({
        kind: thumb.kind,
        storageKey: key,
        mimeType: thumb.mimeType,
        sizeBytes: thumb.buffer.byteLength,
        width: thumb.width,
        height: thumb.height,
      });
    }

    return { derivatives, width, height };
  }

  /** Nunca se usa una key que venga del cliente: la arma siempre el servidor. */
  private buildKey(tenantId: string, sha256: string, mimeType: string): string {
    const extension = EXTENSIONS[mimeType] ?? 'bin';
    return `${this.prefix(tenantId, sha256)}/original.${extension}`;
  }

  private prefix(tenantId: string, sha256: string): string {
    // Los dos primeros bytes del hash reparten los objetos y evitan prefijos
    // gigantes en un solo "directorio".
    return `tenants/${tenantId}/${sha256.slice(0, 2)}/${sha256}`;
  }

  /** Retención según el plan. `null` = para siempre. */
  retentionExpiry(limits: PlanLimits, from: Date): Date | null {
    if (limits.mediaRetentionDays <= 0) return null;
    return new Date(from.getTime() + limits.mediaRetentionDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Borra los bytes de un asset. No toca el objeto si otro asset del tenant lo
   * comparte por deduplicación.
   */
  async removeBytes(asset: MediaAsset): Promise<void> {
    if (!asset.storageKey || !asset.sha256) return;

    const sharing = await this.assetRepo.findStoredBySha256(asset.tenantId, asset.sha256);
    if (sharing && sharing.id !== asset.id) {
      this.logger.debug(`No se borra ${asset.storageKey}: lo comparte el asset ${sharing.id}`);
      return;
    }

    await this.storage.delete(asset.storageKey);
    for (const derivative of asset.derivatives) {
      await this.storage.delete(derivative.storageKey);
    }
  }
}
