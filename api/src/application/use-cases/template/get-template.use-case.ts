import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, TemplateNotFoundError } from '../../../domain/errors/domain-errors.js';

export class GetTemplateUseCase {
  constructor(private readonly templateRepo: MessageTemplateRepository) {}

  async execute(tenantId: string, templateId: string): Promise<Result<MessageTemplate, DomainError>> {
    const template = await this.templateRepo.findById(templateId);
    if (!template || template.tenantId !== tenantId) return err(new TemplateNotFoundError());
    return ok(template);
  }
}
