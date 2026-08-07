import { TemplateCategory } from '../enums/template-category.enum.js';
import { TemplateQuality } from '../enums/template-quality.enum.js';
import { TemplateStatus } from '../enums/template-status.enum.js';

/**
 * Template component stored in Meta Business Management API format
 * (HEADER/BODY/FOOTER/BUTTONS) so it can be sent back to Meta as-is.
 */
export interface MessageTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  /**
   * `LOCATION` no lleva link sino coordenadas, que se pasan al enviar. Los
   * demás formatos de media se resuelven con un `{ link }`.
   */
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: Record<string, unknown>;
  buttons?: Array<{
    /**
     * El juego completo que acepta Meta al crear, verificado contra la API:
     * `QUICK_REPLY, URL, PHONE_NUMBER, OTP, MPM, CATALOG, FLOW, VOICE_CALL,
     * VIDEO_CALL, POSTBACK, BOOKING_STATUS, PAYMENT_REQUEST,
     * REQUEST_CONTACT_INFO`.
     *
     * `COPY_CODE` no está en ese enum de creación pero **sí llega al
     * sincronizar** en las plantillas de cupón, así que se acepta igual: acá se
     * guarda lo que Meta devuelve, no lo que ofrecemos crear.
     *
     * `REQUEST_CONTACT_INFO` es el de las plantillas que Meta autocrea para
     * pedirle el teléfono a quien solo tiene username; su respuesta llega como
     * mensaje `contacts`.
     */
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

export class MessageTemplate {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly phoneNumberId: string,
    public readonly wabaId: string,
    public readonly metaTemplateId: string | null,
    public readonly name: string,
    public readonly language: string,
    public readonly category: TemplateCategory,
    public readonly status: TemplateStatus,
    public readonly qualityScore: TemplateQuality,
    public readonly components: MessageTemplateComponent[],
    public readonly rejectionReason: string | null,
    public readonly lastSyncedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
