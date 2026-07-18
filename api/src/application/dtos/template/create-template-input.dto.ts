import { MessageTemplateComponent } from '../../../domain/entities/message-template.entity.js';
import { TemplateCategory } from '../../../domain/enums/template-category.enum.js';

export interface CreateTemplateInput {
  tenantId: string;
  phoneNumberId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: MessageTemplateComponent[];
}

export interface UpdateTemplateInput {
  tenantId: string;
  templateId: string;
  category?: TemplateCategory;
  components?: MessageTemplateComponent[];
}
