import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { TemplateManagementPort } from '../../ports/template-management.port.js';
import { UpdateTemplateInput } from '../../dtos/template/create-template-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  TemplateNotEditableError,
  TemplateNotFoundError,
  TemplateProviderError,
} from '../../../domain/errors/domain-errors.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';

// Meta only allows editing templates in these review states.
const EDITABLE_STATUSES = [TemplateStatus.APPROVED, TemplateStatus.REJECTED, TemplateStatus.PAUSED];

export class UpdateTemplateUseCase {
  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly templateApi: TemplateManagementPort,
  ) {}

  async execute(input: UpdateTemplateInput): Promise<Result<MessageTemplate, DomainError>> {
    const template = await this.templateRepo.findById(input.templateId);
    if (!template || template.tenantId !== input.tenantId) return err(new TemplateNotFoundError());
    if (!EDITABLE_STATUSES.includes(template.status)) return err(new TemplateNotEditableError(template.status));
    if (!template.metaTemplateId) return err(new TemplateNotEditableError(template.status));

    const phone = await this.phoneRepo.findById(template.phoneNumberId);
    if (!phone) return err(new PhoneNumberNotFoundError());

    try {
      await this.templateApi.updateTemplate({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        wabaId: template.wabaId,
        metaTemplateId: template.metaTemplateId,
        category: input.category,
        components: input.components,
      });
    } catch (error: any) {
      return err(new TemplateProviderError(error?.message));
    }

    // An edited template goes back through Meta review.
    const updated = await this.templateRepo.update(template.id, {
      ...(input.category ? { category: input.category } : {}),
      ...(input.components ? { components: input.components } : {}),
      status: TemplateStatus.PENDING,
      rejectionReason: null,
    });

    return ok(updated!);
  }
}
