import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { ProcessCampaignBatchUseCase } from '../../application/use-cases/campaign/process-campaign-batch.use-case.js';
import { CAMPAIGN_DISPATCH_JOB } from '../../application/use-cases/campaign/start-campaign.use-case.js';

export { CAMPAIGN_DISPATCH_JOB };

@Injectable()
export class CampaignJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(CampaignJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('ProcessCampaignBatchUseCase') private readonly processBatch: ProcessCampaignBatchUseCase,
  ) {}

  onModuleInit(): void {
    // Concurrency 3: up to three campaigns dispatch in parallel; each batch
    // is itself sequential and throttled per phone number.
    this.queue.define(CAMPAIGN_DISPATCH_JOB, async (data) => {
      const { campaignId } = data as { campaignId: string };
      this.logger.debug(`Dispatching campaign batch for ${campaignId}`);
      await this.processBatch.execute({ campaignId });
    }, 3, 5);
  }
}
