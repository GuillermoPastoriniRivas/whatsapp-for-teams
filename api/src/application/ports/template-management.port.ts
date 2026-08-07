import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

/**
 * Template component in Meta Business Management API format
 * (HEADER/BODY/FOOTER/BUTTONS, stored and sent as-is).
 */
export interface TemplateComponentDefinition {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: Record<string, unknown>;
  buttons?: Array<{
    /** Ver el detalle del enum en `message-template.entity.ts`. */
    type:
      | 'QUICK_REPLY'
      | 'URL'
      | 'PHONE_NUMBER'
      | 'OTP'
      | 'MPM'
      | 'CATALOG'
      | 'FLOW'
      | 'VOICE_CALL'
      | 'VIDEO_CALL'
      | 'POSTBACK'
      | 'BOOKING_STATUS'
      | 'PAYMENT_REQUEST'
      | 'REQUEST_CONTACT_INFO'
      | 'COPY_CODE';
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
  /**
   * Cuánto tiempo intenta Meta entregar el mensaje antes de darlo por vencido.
   * Sirve para lo que caduca: un código de un solo uso no vale nada media hora
   * después. Meta acepta 30–900 s en autenticación y hasta 30 días en utilidad.
   */
  messageSendTtlSeconds?: number;
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
  /** Borrado masivo: Meta acepta hasta 100 ids por request (`hsm_ids`). */
  deleteTemplates(params: TemplateProviderContext, metaTemplateIds: string[]): Promise<void>;
  listTemplates(params: TemplateProviderContext): Promise<RemoteTemplate[]>;
}
