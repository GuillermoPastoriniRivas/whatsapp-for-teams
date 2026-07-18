import { Logger } from '@nestjs/common';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { TemplateEventInput } from '../../dtos/webhook/template-event-input.dto.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { mapMetaTemplateQuality } from '../template/helpers/meta-template.mapper.js';

export class HandleTemplateQualityUpdateUseCase {
  private readonly logger = new Logger(HandleTemplateQualityUpdateUseCase.name);

  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: TemplateEventInput): Promise<void> {
    const template = input.metaTemplateId
      ? await this.templateRepo.findByMetaTemplateId(input.metaTemplateId)
      : await this.templateRepo.findByWabaNameLanguage(input.wabaId, input.name, input.language);

    if (!template) {
      this.logger.warn(`Quality update for unknown template ${input.name}/${input.language} (waba ${input.wabaId})`);
      return;
    }

    const qualityScore = mapMetaTemplateQuality(input.newQualityScore);
    await this.templateRepo.update(template.id, { qualityScore });

    this.gateway.emitToTenant(template.tenantId, 'template.updated', {
      templateId: template.id,
      qualityScore,
    });
  }
}
