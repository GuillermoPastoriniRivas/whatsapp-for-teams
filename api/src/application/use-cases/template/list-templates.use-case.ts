import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { MessageTemplateFilters, MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';

export class ListTemplatesUseCase {
  constructor(private readonly templateRepo: MessageTemplateRepository) {}

  async execute(filters: MessageTemplateFilters): Promise<PaginatedResult<MessageTemplate>> {
    return this.templateRepo.findByFilters(filters);
  }
}
