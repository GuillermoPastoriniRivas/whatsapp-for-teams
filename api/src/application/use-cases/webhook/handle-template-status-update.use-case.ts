import { Logger } from '@nestjs/common';
import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { TemplateEventInput } from '../../dtos/webhook/template-event-input.dto.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { mapMetaTemplateStatus } from '../template/helpers/meta-template.mapper.js';

export class HandleTemplateStatusUpdateUseCase {
  private readonly logger = new Logger(HandleTemplateStatusUpdateUseCase.name);

  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly campaignRepo: CampaignRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: TemplateEventInput): Promise<void> {
    const template = await this.findTemplate(input);
    if (!template) {
      this.logger.warn(`Template status update for unknown template ${input.name}/${input.language} (waba ${input.wabaId})`);
      return;
    }

    const status = mapMetaTemplateStatus(input.event);
    await this.templateRepo.update(template.id, {
      status,
      rejectionReason: status === TemplateStatus.REJECTED ? (input.reason ?? null) : null,
      // Backfill the Meta id if the template was created before Meta assigned one.
      ...(input.metaTemplateId && !template.metaTemplateId ? { metaTemplateId: input.metaTemplateId } : {}),
    });

    this.gateway.emitToTenant(template.tenantId, 'template.updated', {
      templateId: template.id,
      status,
      reason: input.reason ?? null,
    });

    // A paused/disabled template can no longer be sent — stop its running campaigns.
    if (status === TemplateStatus.PAUSED || status === TemplateStatus.DISABLED) {
      const running = await this.campaignRepo.findRunningByTemplateId(template.id);
      for (const campaign of running) {
        const paused = await this.campaignRepo.transitionStatus(
          campaign.id,
          [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED],
          CampaignStatus.PAUSED,
          { failureReason: `Template ${template.name} was ${status} by Meta` },
        );
        if (paused) {
          this.gateway.emitToTenant(template.tenantId, 'campaign.updated', {
            campaignId: campaign.id,
            status: CampaignStatus.PAUSED,
          });
        }
      }
    }
  }

  private async findTemplate(input: TemplateEventInput): Promise<MessageTemplate | null> {
    if (input.metaTemplateId) {
      const byId = await this.templateRepo.findByMetaTemplateId(input.metaTemplateId);
      if (byId) return byId;
    }
    if (input.name && input.language) {
      return this.templateRepo.findByWabaNameLanguage(input.wabaId, input.name, input.language);
    }
    return null;
  }
}
