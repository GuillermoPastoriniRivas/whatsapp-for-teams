import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { HandleInboundMessageUseCase } from '../../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-status-update.use-case.js';
import { HandleTemplateStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-template-status-update.use-case.js';
import { HandleTemplateQualityUpdateUseCase } from '../../application/use-cases/webhook/handle-template-quality-update.use-case.js';
import { HandleTemplateCategoryUpdateUseCase } from '../../application/use-cases/webhook/handle-template-category-update.use-case.js';
import type { InboundMessageInput } from '../../application/dtos/webhook/inbound-message-input.dto.js';
import type { StatusUpdateInput } from '../../application/dtos/webhook/status-update-input.dto.js';
import type { TemplateEventInput } from '../../application/dtos/webhook/template-event-input.dto.js';

export const INBOUND_MESSAGE_JOB = 'webhook.inbound-message';
export const STATUS_UPDATE_JOB = 'webhook.status-update';
export const TEMPLATE_EVENT_JOB = 'webhook.template-event';

@Injectable()
export class WebhookJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(WebhookJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('HandleInboundMessageUseCase') private readonly handleInbound: HandleInboundMessageUseCase,
    @Inject('HandleStatusUpdateUseCase') private readonly handleStatus: HandleStatusUpdateUseCase,
    @Inject('HandleTemplateStatusUpdateUseCase') private readonly handleTemplateStatus: HandleTemplateStatusUpdateUseCase,
    @Inject('HandleTemplateQualityUpdateUseCase') private readonly handleTemplateQuality: HandleTemplateQualityUpdateUseCase,
    @Inject('HandleTemplateCategoryUpdateUseCase') private readonly handleTemplateCategory: HandleTemplateCategoryUpdateUseCase,
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

    this.queue.define(TEMPLATE_EVENT_JOB, async (data) => {
      const input = data as TemplateEventInput;
      this.logger.debug(`Processing template event ${input.field} for ${input.name}/${input.language}`);
      switch (input.field) {
        case 'message_template_status_update':
          await this.handleTemplateStatus.execute(input);
          break;
        case 'message_template_quality_update':
          await this.handleTemplateQuality.execute(input);
          break;
        case 'template_category_update':
          await this.handleTemplateCategory.execute(input);
          break;
        default:
          this.logger.warn(`Unknown template event field: ${input.field}`);
      }
    }, 5);
  }
}
