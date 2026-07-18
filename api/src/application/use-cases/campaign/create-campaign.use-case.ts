import { Campaign, CampaignThrottle } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { CreateCampaignInputDto } from '../../dtos/campaign/campaign-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  InvalidVariableMappingError,
  PhoneNumberNotFoundError,
  TemplateNotApprovedError,
  TemplateNotFoundError,
} from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { listTemplatePlaceholders } from './helpers/template-variable.resolver.js';
import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { CampaignVariableMapping } from '../../../domain/entities/campaign.entity.js';

// Hard ceiling well under Meta's ~80 msg/s per number.
const MAX_MESSAGES_PER_SECOND = 40;
const MAX_BATCH_SIZE = 200;

export const EMPTY_CAMPAIGN_COUNTS = {
  total: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, replied: 0,
};

export function normalizeThrottle(throttle?: Partial<CampaignThrottle>): CampaignThrottle {
  return {
    messagesPerSecond: Math.min(Math.max(throttle?.messagesPerSecond ?? 10, 1), MAX_MESSAGES_PER_SECOND),
    batchSize: Math.min(Math.max(throttle?.batchSize ?? 50, 1), MAX_BATCH_SIZE),
  };
}

/** Every placeholder in the template must have exactly one mapping. */
export function validateMappings(
  template: MessageTemplate,
  mappings: CampaignVariableMapping[],
): InvalidVariableMappingError | null {
  const placeholders = listTemplatePlaceholders(template.components);
  const unmapped = placeholders.filter(
    (p) =>
      !mappings.some(
        (m) => m.component === p.component && m.position === p.position && (p.component !== 'button' || m.index === p.index),
      ),
  );
  if (unmapped.length > 0) {
    const keys = unmapped.map((p) => (p.component === 'button' ? `button[${p.index}].${p.position}` : `${p.component}.${p.position}`));
    return new InvalidVariableMappingError(`Missing mappings for template placeholders: ${keys.join(', ')}`);
  }
  return null;
}

export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
  ) {}

  async execute(input: CreateCampaignInputDto): Promise<Result<Campaign, DomainError>> {
    const template = await this.templateRepo.findById(input.templateId);
    if (!template || template.tenantId !== input.tenantId) return err(new TemplateNotFoundError());
    if (template.status !== TemplateStatus.APPROVED) return err(new TemplateNotApprovedError());

    const phone = await this.phoneRepo.findById(input.phoneNumberId);
    if (!phone || phone.tenantId !== input.tenantId || phone.status !== 'active') {
      return err(new PhoneNumberNotFoundError());
    }
    if (template.phoneNumberId !== phone.id) {
      return err(new DomainError('TEMPLATE_PHONE_MISMATCH', 'The template belongs to a different phone number.'));
    }

    const mappingError = validateMappings(template, input.variableMappings);
    if (mappingError) return err(mappingError);

    if (input.audience.type === 'contactIds' && (!input.audience.contactIds || input.audience.contactIds.length === 0)) {
      return err(new DomainError('EMPTY_AUDIENCE', 'audience.contactIds must not be empty.'));
    }

    const campaign = await this.campaignRepo.create({
      tenantId: input.tenantId,
      phoneNumberId: input.phoneNumberId,
      templateId: input.templateId,
      name: input.name,
      status: CampaignStatus.DRAFT,
      variableMappings: input.variableMappings,
      audience: input.audience,
      scheduledAt: input.scheduledAt ?? null,
      startedAt: null,
      completedAt: null,
      throttle: normalizeThrottle(input.throttle),
      replyWindowHours: input.replyWindowHours ?? 72,
      counts: { ...EMPTY_CAMPAIGN_COUNTS },
      createdByAgentId: input.createdByAgentId,
      failureReason: null,
    });

    return ok(campaign);
  }
}
