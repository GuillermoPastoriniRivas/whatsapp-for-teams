import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { MessageTemplateFilters, MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';

export class ListTemplatesUseCase {
  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
  ) {}

  async execute(filters: MessageTemplateFilters): Promise<PaginatedResult<MessageTemplate>> {
    // Filtrar por número mostraría solo las plantillas que ese número sincronizó
    // primero: en Meta son de la WABA y las comparten todos sus números. Se
    // traduce el filtro a la WABA del número pedido.
    if (filters.phoneNumberId) {
      const phone = await this.phoneRepo.findById(filters.phoneNumberId);
      if (phone && phone.tenantId === filters.tenantId && phone.wabaId) {
        return this.templateRepo.findByFilters({ ...filters, wabaId: phone.wabaId });
      }
    }
    return this.templateRepo.findByFilters(filters);
  }
}
