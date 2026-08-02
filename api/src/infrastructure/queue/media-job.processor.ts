import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { IngestMediaAssetUseCase } from '../../application/use-cases/media/ingest-media-asset.use-case.js';
import { BackfillTenantMediaUseCase, MEDIA_BACKFILL_JOB } from '../../application/use-cases/media/backfill-tenant-media.use-case.js';
import { MediaMaintenanceUseCase, MEDIA_MAINTENANCE_JOB } from '../../application/use-cases/media/media-maintenance.use-case.js';
import { MEDIA_INGEST_JOB } from '../../application/use-cases/media/register-inbound-media.use-case.js';

@Injectable()
export class MediaJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(MediaJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('IngestMediaAssetUseCase') private readonly ingest: IngestMediaAssetUseCase,
    @Inject('BackfillTenantMediaUseCase') private readonly backfill: BackfillTenantMediaUseCase,
    @Inject('MediaMaintenanceUseCase') private readonly maintenance: MediaMaintenanceUseCase,
  ) {}

  onModuleInit(): void {
    // Concurrencia baja a propósito: bajar decenas de archivos en paralelo
    // contra Graph se come el rate limit del WABA, que es compartido con el
    // envío de mensajes del mismo número.
    this.queue.define(
      MEDIA_INGEST_JOB,
      async (data) => {
        const { assetId } = data as { assetId: string };
        await this.ingest.execute({ assetId });
      },
      3,
      5,
    );

    this.queue.define(
      MEDIA_BACKFILL_JOB,
      async (data) => {
        const { tenantId } = data as { tenantId: string };
        await this.backfill.execute(tenantId);
      },
      1,
    );

    this.queue.define(
      MEDIA_MAINTENANCE_JOB,
      async () => {
        await this.maintenance.execute();
      },
      1,
    );

    // Una vez por hora alcanza: nada de esto es urgente al minuto.
    void this.queue.every('1 hour', MEDIA_MAINTENANCE_JOB).catch((error) => {
      this.logger.error(`No se pudo programar el mantenimiento de media: ${error.message}`);
    });
  }
}
