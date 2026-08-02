import { Logger } from '@nestjs/common';
import { MediaAssetStatus } from '../../../domain/enums/media-asset-status.enum.js';
import { kindFromMimeType } from '../../../domain/constants/media-constraints.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { resolveMimeType } from '../../../domain/services/mime-sniffer.js';
import { MediaGoneAtSourceError } from '../../ports/media-provider.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { MediaAccessService } from './media-access.service.js';
import { MediaStorageService } from './media-storage.service.js';

export interface IngestMediaAssetInput {
  assetId: string;
}

/**
 * Baja el archivo del proveedor y lo guarda en nuestro storage.
 *
 * Corre en la cola porque son dos requests contra Graph y hasta 100 MB de
 * transferencia: nada de eso puede pasar dentro del handler del webhook.
 */
export class IngestMediaAssetUseCase {
  private readonly logger = new Logger(IngestMediaAssetUseCase.name);

  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
    private readonly mediaStorage: MediaStorageService,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: IngestMediaAssetInput): Promise<void> {
    const asset = await this.assetRepo.findById(input.assetId);
    if (!asset) return;

    // El job se puede reintentar y el backfill puede pisar un asset ya bajado.
    if (asset.isStored) return;

    if (!(await this.mediaAccess.hasStorage(asset.tenantId))) {
      this.logger.debug(`Tenant ${asset.tenantId} sin storage: ${asset.id} queda en passthrough`);
      return;
    }

    await this.assetRepo.update(asset.id, { status: MediaAssetStatus.PENDING });

    let downloaded;
    try {
      downloaded = await this.mediaAccess.downloadFromProvider(asset);
    } catch (error: any) {
      if (error instanceof MediaGoneAtSourceError) {
        // Se venció en Meta antes de que llegáramos. No hay reintento posible:
        // el archivo se perdió y hay que decirlo, no dejar un spinner eterno.
        await this.assetRepo.update(asset.id, {
          status: MediaAssetStatus.EXPIRED_AT_SOURCE,
          failureReason: 'El archivo ya no estaba disponible en WhatsApp (límite de 30 días).',
        });
        this.notify(asset.tenantId, asset.conversationId, asset.id, 'expired');
        return;
      }
      await this.assetRepo.update(asset.id, {
        status: MediaAssetStatus.META_ONLY,
        failureReason: error?.message ?? 'Error desconocido al descargar.',
      });
      throw error; // la cola reintenta con backoff
    }

    // Los bytes mandan sobre lo que declaró el proveedor.
    const mimeType = resolveMimeType(downloaded.buffer, downloaded.mimeType, asset.filename);
    const kind = kindFromMimeType(mimeType) ?? asset.kind;

    const stored = await this.mediaStorage.store({
      tenantId: asset.tenantId,
      buffer: downloaded.buffer,
      mimeType,
      kind,
      filename: asset.filename,
    });

    // Verificación de integridad contra lo que reportó el proveedor.
    if (asset.sha256 && asset.sha256 !== stored.sha256) {
      this.logger.warn(
        `Hash distinto al declarado en ${asset.id}: esperado ${asset.sha256}, obtenido ${stored.sha256}`,
      );
    }

    const limits = await this.mediaAccess.planFor(asset.tenantId);

    await this.assetRepo.update(asset.id, {
      status: MediaAssetStatus.READY,
      failureReason: null,
      mimeType,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      derivatives: stored.derivatives,
      width: stored.width,
      height: stored.height,
      expiresAt: this.mediaStorage.retentionExpiry(limits, new Date()),
    });

    this.logger.debug(
      `Media ${asset.id} guardado (${stored.sizeBytes} bytes${stored.deduplicated ? ', deduplicado' : ''})`,
    );

    this.notify(asset.tenantId, asset.conversationId, asset.id, 'ready');
  }

  /** La burbuja muestra un placeholder hasta que llega este evento. */
  private notify(
    tenantId: string,
    conversationId: string | null,
    assetId: string,
    status: 'ready' | 'expired',
  ): void {
    const payload = { assetId, status };
    if (conversationId) this.gateway.emitToConversation(conversationId, 'media.updated', payload);
    this.gateway.emitToTenant(tenantId, 'media.updated', payload);
  }
}
