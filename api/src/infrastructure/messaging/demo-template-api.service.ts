import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateTemplateParams,
  DeleteTemplateParams,
  RemoteTemplate,
  TemplateProviderContext,
  UpdateTemplateParams,
} from '../../application/ports/template-management.port.js';

/**
 * Demo provider: auto-approves templates so the full template/campaign flow
 * can be exercised end-to-end without a real Meta account.
 */
@Injectable()
export class DemoTemplateApiService {
  async createTemplate(_params: CreateTemplateParams): Promise<{ metaTemplateId: string; status: string }> {
    return { metaTemplateId: `demo-${randomUUID()}`, status: 'APPROVED' };
  }

  async updateTemplate(_params: UpdateTemplateParams): Promise<void> {
    return;
  }

  async deleteTemplate(_params: DeleteTemplateParams): Promise<void> {
    return;
  }

  async listTemplates(_params: TemplateProviderContext): Promise<RemoteTemplate[]> {
    return [];
  }
}
