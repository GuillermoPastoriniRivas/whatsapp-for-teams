import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { TemplateManagementPort } from '../../ports/template-management.port.js';
import { CreateTemplateInput } from '../../dtos/template/create-template-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  TemplateProviderError,
  WabaNotConfiguredError,
} from '../../../domain/errors/domain-errors.js';
import { TemplateQuality } from '../../../domain/enums/template-quality.enum.js';
import { mapMetaTemplateStatus } from './helpers/meta-template.mapper.js';

export class CreateTemplateUseCase {
  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly templateApi: TemplateManagementPort,
  ) {}

  async execute(input: CreateTemplateInput): Promise<Result<MessageTemplate, DomainError>> {
    const phone = await this.phoneRepo.findById(input.phoneNumberId);
    if (!phone || phone.tenantId !== input.tenantId) return err(new PhoneNumberNotFoundError());
    if (!phone.wabaId) return err(new WabaNotConfiguredError());

    const existing = await this.templateRepo.findByWabaNameLanguage(phone.wabaId, input.name, input.language);
    if (existing) {
      return err(new DomainError('TEMPLATE_ALREADY_EXISTS', 'A template with this name and language already exists.'));
    }

    let metaTemplateId: string;
    let metaStatus: string;
    try {
      const created = await this.templateApi.createTemplate({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        wabaId: phone.wabaId,
        name: input.name,
        language: input.language,
        category: input.category,
        components: input.components,
      });
      metaTemplateId = created.metaTemplateId;
      metaStatus = created.status;
    } catch (error: any) {
      return err(new TemplateProviderError(error?.message));
    }

    const template = await this.templateRepo.create({
      tenantId: input.tenantId,
      phoneNumberId: phone.id,
      wabaId: phone.wabaId,
      metaTemplateId,
      name: input.name,
      language: input.language,
      category: input.category,
      status: mapMetaTemplateStatus(metaStatus),
      qualityScore: TemplateQuality.UNKNOWN,
      components: input.components,
      rejectionReason: null,
      lastSyncedAt: new Date(),
    });

    return ok(template);
  }
}
