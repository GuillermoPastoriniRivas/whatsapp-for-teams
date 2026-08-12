import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { RateChargesUseCase } from '../../application/use-cases/billing/rate-charges.use-case.js';

export const RATE_CHARGES_JOB = 'billing:rate-charges';

@Injectable()
export class BillingJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(BillingJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('RateChargesUseCase') private readonly rateCharges: RateChargesUseCase,
  ) {}

  onModuleInit(): void {
    // Concurrencia 1: dos corridas en paralelo tarifarían las mismas filas dos
    // veces. `setRate` no es idempotente por sí solo.
    this.queue.define(
      RATE_CHARGES_JOB,
      async () => {
        const result = await this.rateCharges.execute();
        if (result.processed > 0) {
          this.logger.log(
            `Tarifados ${result.rated}/${result.processed} entregados` +
              (result.missingRate ? `, ${result.missingRate} sin precio` : ''),
          );
        }
      },
      1,
    );

    // Cada quince minutos. No hace falta más: nadie mira el costo al segundo, y
    // la tarifa depende de una rate card que puede cargarse después del envío.
    void this.queue.every('15 minutes', RATE_CHARGES_JOB).catch((error) => {
      this.logger.error(`No se pudo programar la tarifación de mensajes: ${error.message}`);
    });
  }
}
