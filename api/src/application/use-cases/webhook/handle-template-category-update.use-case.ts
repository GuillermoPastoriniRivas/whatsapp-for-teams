import { Logger } from '@nestjs/common';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { TemplateEventInput } from '../../dtos/webhook/template-event-input.dto.js';
import { mapMetaTemplateCategory } from '../template/helpers/meta-template.mapper.js';

export class HandleTemplateCategoryUpdateUseCase {
  private readonly logger = new Logger(HandleTemplateCategoryUpdateUseCase.name);

  constructor(private readonly templateRepo: MessageTemplateRepository) {}

  async execute(input: TemplateEventInput): Promise<void> {
    const template = input.metaTemplateId
      ? await this.templateRepo.findByMetaTemplateId(input.metaTemplateId)
      : await this.templateRepo.findByWabaNameLanguage(input.wabaId, input.name, input.language);

    if (!template) {
      this.logger.warn(`Category update for unknown template ${input.name}/${input.language} (waba ${input.wabaId})`);
      return;
    }

    const category = mapMetaTemplateCategory(input.newCategory);
    if (!category) return;

    await this.templateRepo.update(template.id, { category });
  }
}
