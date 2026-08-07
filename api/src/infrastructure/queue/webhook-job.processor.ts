import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { HandleInboundMessageUseCase } from '../../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-status-update.use-case.js';
import { HandleTemplateStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-template-status-update.use-case.js';
import { HandleTemplateQualityUpdateUseCase } from '../../application/use-cases/webhook/handle-template-quality-update.use-case.js';
import { HandleTemplateCategoryUpdateUseCase } from '../../application/use-cases/webhook/handle-template-category-update.use-case.js';
import { HandleUserIdUpdateUseCase } from '../../application/use-cases/webhook/handle-user-id-update.use-case.js';
import { HandleAccountEventUseCase } from '../../application/use-cases/webhook/handle-account-event.use-case.js';
import { HandleUserPreferenceUseCase } from '../../application/use-cases/webhook/handle-user-preference.use-case.js';
import type { InboundMessageInput, UserIdUpdateInput } from '../../application/dtos/webhook/inbound-message-input.dto.js';
import type { StatusUpdateInput } from '../../application/dtos/webhook/status-update-input.dto.js';
import type { TemplateEventInput } from '../../application/dtos/webhook/template-event-input.dto.js';
import type { AccountEventInput, UserPreferenceInput } from '../../application/dtos/webhook/account-event-input.dto.js';

export const INBOUND_MESSAGE_JOB = 'webhook.inbound-message';
export const STATUS_UPDATE_JOB = 'webhook.status-update';
export const TEMPLATE_EVENT_JOB = 'webhook.template-event';
export const USER_ID_UPDATE_JOB = 'webhook.user-id-update';
export const ACCOUNT_EVENT_JOB = 'webhook.account-event';
export const USER_PREFERENCE_JOB = 'webhook.user-preference';

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
    @Inject('HandleUserIdUpdateUseCase') private readonly handleUserIdUpdate: HandleUserIdUpdateUseCase,
    @Inject('HandleAccountEventUseCase') private readonly handleAccountEvent: HandleAccountEventUseCase,
    @Inject('HandleUserPreferenceUseCase') private readonly handleUserPreference: HandleUserPreferenceUseCase,
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

    this.queue.define(USER_ID_UPDATE_JOB, async (data) => {
      const input = data as UserIdUpdateInput;
      this.logger.debug(`Processing BSUID change ${input.previousBsuid} → ${input.newBsuid}`);
      await this.handleUserIdUpdate.execute(input);
    }, 5);

    this.queue.define(ACCOUNT_EVENT_JOB, async (data) => {
      const input = data as AccountEventInput;
      this.logger.debug(`Processing account event ${input.field} for WABA ${input.wabaId}`);
      await this.handleAccountEvent.execute(input);
    }, 5);

    this.queue.define(USER_PREFERENCE_JOB, async (data) => {
      const input = data as UserPreferenceInput;
      input.timestamp = new Date(input.timestamp);
      await this.handleUserPreference.execute(input);
    }, 5);

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
