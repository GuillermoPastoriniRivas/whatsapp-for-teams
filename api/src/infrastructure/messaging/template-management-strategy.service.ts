import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import {
  CreateTemplateParams,
  DeleteTemplateParams,
  RemoteTemplate,
  TemplateManagementPort,
  TemplateProviderContext,
  UpdateTemplateParams,
} from '../../application/ports/template-management.port.js';
import { MetaTemplateApiService } from './meta-template-api.service.js';
import { DemoTemplateApiService } from './demo-template-api.service.js';

@Injectable()
export class TemplateManagementStrategyService implements TemplateManagementPort {
  constructor(
    private readonly metaService: MetaTemplateApiService,
    private readonly demoService: DemoTemplateApiService,
  ) {}

  async createTemplate(params: CreateTemplateParams): Promise<{ metaTemplateId: string; status: string }> {
    return this.resolve(params.provider).createTemplate(params);
  }

  async updateTemplate(params: UpdateTemplateParams): Promise<void> {
    return this.resolve(params.provider).updateTemplate(params);
  }

  async deleteTemplate(params: DeleteTemplateParams): Promise<void> {
    return this.resolve(params.provider).deleteTemplate(params);
  }

  async deleteTemplates(params: TemplateProviderContext, metaTemplateIds: string[]): Promise<void> {
    return this.resolve(params.provider).deleteTemplates(params, metaTemplateIds);
  }

  async listTemplates(params: TemplateProviderContext): Promise<RemoteTemplate[]> {
    return this.resolve(params.provider).listTemplates(params);
  }

  private resolve(provider: MessagingProvider): MetaTemplateApiService | DemoTemplateApiService {
    switch (provider) {
      case MessagingProvider.META:
        return this.metaService;
      case MessagingProvider.DEMO:
        return this.demoService;
      default:
        throw new Error(`Template management not supported for provider: ${provider}`);
    }
  }
}
