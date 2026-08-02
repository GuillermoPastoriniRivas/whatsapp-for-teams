import { Logger } from '@nestjs/common';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MediaProviderRefRepository } from '../../../domain/repositories/media-provider-ref.repository.js';
import { MediaStorageService } from './media-storage.service.js';

export const MEDIA_MAINTENANCE_JOB = 'media.maintenance';

const PURGE_BATCH = 200;

/**
 * Barrido periódico:
 *
 * 1. Marca como perdidos los archivos que se vencieron en Meta sin que los
 *    hayamos bajado. Sin esto la UI muestra un spinner para siempre.
 * 2. Purga los que superaron la retención del plan, respetando la
 *    deduplicación (un objeto compartido por dos assets no se borra).
 */
export class MediaMaintenanceUseCase {
  private readonly logger = new Logger(MediaMaintenanceUseCase.name);

  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly refRepo: MediaProviderRefRepository,
    private readonly mediaStorage: MediaStorageService,
  ) {}

  async execute(): Promise<{ expired: number; purged: number }> {
    const now = new Date();

    const expired = await this.assetRepo.markExpiredAtSource(now);
    if (expired > 0) {
      this.logger.log(`${expired} archivos marcados como vencidos en el origen`);
    }

    const purged = await this.purgeExpiredStored(now);
    if (purged > 0) {
      this.logger.log(`${purged} archivos purgados por retención vencida`);
    }

    return { expired, purged };
  }

  private async purgeExpiredStored(now: Date): Promise<number> {
    const batch = await this.assetRepo.findExpiredStored(now, PURGE_BATCH);

    for (const asset of batch) {
      try {
        await this.mediaStorage.removeBytes(asset);
        await this.refRepo.deleteByAssetId(asset.id);
        await this.assetRepo.hardDelete(asset.id);
      } catch (error: any) {
        this.logger.error(`No se pudo purgar ${asset.id}: ${error?.message}`);
      }
    }

    return batch.length;
  }
}
