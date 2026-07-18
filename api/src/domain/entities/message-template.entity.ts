import { TemplateCategory } from '../enums/template-category.enum.js';
import { TemplateQuality } from '../enums/template-quality.enum.js';
import { TemplateStatus } from '../enums/template-status.enum.js';

/**
 * Template component stored in Meta Business Management API format
 * (HEADER/BODY/FOOTER/BUTTONS) so it can be sent back to Meta as-is.
 */
export interface MessageTemplateComponent {
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
