import { Logger } from '@nestjs/common';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { MediaAccessService } from './media-access.service.js';
import { MEDIA_INGEST_JOB } from './register-inbound-media.use-case.js';

export const MEDIA_BACKFILL_JOB = 'media.backfill-tenant';

/** Tope por corrida: encolar 50k jobs de una sentada estrangula la cola. */
const BATCH_SIZE = 500;

/**
 * Rescate al pasar a un plan pago.
 *
 * Cuando un tenant free upgradea, todo el media de los últimos 30 días
 * todavía existe en Meta. Bajarlo en ese momento es el mejor onboarding
 * posible —valor tangible en el instante en que pagaron— y es irrepetible: lo
 * de hace 31 días ya no vuelve.
 */
export class BackfillTenantMediaUseCase {
  private readonly logger = new Logger(BackfillTenantMediaUseCase.name);

  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
    private readonly jobQueue: JobQueuePort,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  /** Cuántos archivos se pueden rescatar ahora mismo. */
  async countPending(tenantId: string): Promise<number> {
    if (!(await this.mediaAccess.hasStorage(tenantId))) return 0;
    return this.assetRepo.countBackfillCandidates(tenantId, new Date());
  }

  async execute(tenantId: string): Promise<{ queued: number; remaining: number }> {
    if (!(await this.mediaAccess.hasStorage(tenantId))) {
      return { queued: 0, remaining: 0 };
    }

    const now = new Date();
    const candidates = await this.assetRepo.findBackfillCandidates(tenantId, now, BATCH_SIZE);

    for (const asset of candidates) {
      await this.jobQueue.enqueue(MEDIA_INGEST_JOB, { assetId: asset.id });
    }

    const remaining = await this.assetRepo.countBackfillCandidates(tenantId, now);

    // Quedan más de los que entran en un lote: se reencola para seguir. Así el
    // rescate avanza sin bloquear la cola ni pegarle de golpe a Graph.
    if (remaining > 0 && candidates.length === BATCH_SIZE) {
      await this.jobQueue.enqueue(MEDIA_BACKFILL_JOB, { tenantId });
    }

    this.logger.log(`Backfill de ${tenantId}: ${candidates.length} encolados, ${remaining} pendientes`);

    this.gateway.emitToTenant(tenantId, 'media.backfill', {
      queued: candidates.length,
      remaining,
    });

    return { queued: candidates.length, remaining };
  }
}
