import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

/**
 * Template component in Meta Business Management API format
 * (HEADER/BODY/FOOTER/BUTTONS, stored and sent as-is).
 */
export interface TemplateComponentDefinition {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: Record<string, unknown>;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
  }>;
}

export interface RemoteTemplate {
  metaTemplateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  qualityScore: string | null;
  components: TemplateComponentDefinition[];
  rejectionReason: string | null;
}

export interface TemplateProviderContext {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  wabaId: string;
}

export interface CreateTemplateParams extends TemplateProviderContext {
  name: string;
  language: string;
  category: string;
  components: TemplateComponentDefinition[];
}

export interface UpdateTemplateParams extends TemplateProviderContext {
  metaTemplateId: string;
  category?: string;
  components?: TemplateComponentDefinition[];
}

export interface DeleteTemplateParams extends TemplateProviderContext {
  name: string;
  metaTemplateId?: string | null;
}

export interface TemplateManagementPort {
  createTemplate(params: CreateTemplateParams): Promise<{ metaTemplateId: string; status: string }>;
  updateTemplate(params: UpdateTemplateParams): Promise<void>;
  deleteTemplate(params: DeleteTemplateParams): Promise<void>;
  listTemplates(params: TemplateProviderContext): Promise<RemoteTemplate[]>;
}
