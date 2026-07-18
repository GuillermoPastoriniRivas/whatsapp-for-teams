import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { TemplateManagementPort } from '../../ports/template-management.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  TemplateInUseError,
  TemplateNotFoundError,
  TemplateProviderError,
} from '../../../domain/errors/domain-errors.js';

export class DeleteTemplateUseCase {
  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly campaignRepo: CampaignRepository,
    private readonly templateApi: TemplateManagementPort,
  ) {}

  async execute(tenantId: string, templateId: string): Promise<Result<void, DomainError>> {
    const template = await this.templateRepo.findById(templateId);
    if (!template || template.tenantId !== tenantId) return err(new TemplateNotFoundError());

    const activeCampaigns = await this.campaignRepo.findRunningByTemplateId(template.id);
    if (activeCampaigns.length > 0) return err(new TemplateInUseError());

    const phone = await this.phoneRepo.findById(template.phoneNumberId);
    if (!phone) return err(new PhoneNumberNotFoundError());

    try {
      await this.templateApi.deleteTemplate({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        wabaId: template.wabaId,
        name: template.name,
        metaTemplateId: template.metaTemplateId,
      });
    } catch (error: any) {
      return err(new TemplateProviderError(error?.message));
    }

    await this.templateRepo.delete(template.id);
    return ok(undefined);
  }
}
