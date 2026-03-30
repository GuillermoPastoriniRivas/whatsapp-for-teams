import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { HandleInboundMessageUseCase } from '../../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-status-update.use-case.js';
import type { InboundMessageInput } from '../../application/dtos/webhook/inbound-message-input.dto.js';
import type { StatusUpdateInput } from '../../application/dtos/webhook/status-update-input.dto.js';

export const INBOUND_MESSAGE_JOB = 'webhook.inbound-message';
export const STATUS_UPDATE_JOB = 'webhook.status-update';

@Injectable()
export class WebhookJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(WebhookJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('HandleInboundMessageUseCase') private readonly handleInbound: HandleInboundMessageUseCase,
    @Inject('HandleStatusUpdateUseCase') private readonly handleStatus: HandleStatusUpdateUseCase,
  ) {}

  onModuleInit(): void {
    this.queue.define(INBOUND_MESSAGE_JOB, async (data) => {
      const input = data as InboundMessageInput;
      input.timestamp = new Date(input.timestamp);
      this.logger.debug(`Processing inbound message ${input.waMessageId}`);
      await this.handleInbound.execute(input);
    }, 5);

    this.queue.define(STATUS_UPDATE_JOB, async (data) => {
      const input = data as StatusUpdateInput;
      input.timestamp = new Date(input.timestamp);
      await this.handleStatus.execute(input);
    }, 10);
  }
}
