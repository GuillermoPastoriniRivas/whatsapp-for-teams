import { MessageTemplate } from '../entities/message-template.entity.js';
import { TemplateStatus } from '../enums/template-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export interface MessageTemplateFilters {
  tenantId: string;
  phoneNumberId?: string;
  status?: TemplateStatus;
  search?: string;
  page: number;
  limit: number;
}

export type CreateMessageTemplateInput = Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>;

export interface MessageTemplateRepository {
  create(template: CreateMessageTemplateInput): Promise<MessageTemplate>;
  findById(id: string): Promise<MessageTemplate | null>;
  findByFilters(filters: MessageTemplateFilters): Promise<PaginatedResult<MessageTemplate>>;
  findByMetaTemplateId(metaTemplateId: string): Promise<MessageTemplate | null>;
  findByWabaNameLanguage(wabaId: string, name: string, language: string): Promise<MessageTemplate | null>;
  update(id: string, data: Partial<Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>>): Promise<MessageTemplate | null>;
  upsertFromSync(template: CreateMessageTemplateInput): Promise<MessageTemplate>;
  delete(id: string): Promise<void>;
}
