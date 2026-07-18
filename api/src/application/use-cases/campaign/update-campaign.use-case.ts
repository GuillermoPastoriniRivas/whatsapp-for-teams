import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { UpdateCampaignInputDto } from '../../dtos/campaign/campaign-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  CampaignNotFoundError,
  InvalidCampaignStateError,
  TemplateNotApprovedError,
  TemplateNotFoundError,
} from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { normalizeThrottle, validateMappings } from './create-campaign.use-case.js';

export class UpdateCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly templateRepo: MessageTemplateRepository,
  ) {}

  async execute(input: UpdateCampaignInputDto): Promise<Result<Campaign, DomainError>> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign || campaign.tenantId !== input.tenantId) return err(new CampaignNotFoundError());
    if (campaign.status !== CampaignStatus.DRAFT) {
      return err(new InvalidCampaignStateError('Only draft campaigns can be edited.'));
    }

    const templateId = input.templateId ?? campaign.templateId;
    const template = await this.templateRepo.findById(templateId);
    if (!template || template.tenantId !== input.tenantId) return err(new TemplateNotFoundError());
    if (template.status !== TemplateStatus.APPROVED) return err(new TemplateNotApprovedError());

    const mappings = input.variableMappings ?? campaign.variableMappings;
    const mappingError = validateMappings(template, mappings);
    if (mappingError) return err(mappingError);

    const updated = await this.campaignRepo.update(campaign.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(input.variableMappings !== undefined ? { variableMappings: input.variableMappings } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
      ...(input.throttle !== undefined ? { throttle: normalizeThrottle(input.throttle) } : {}),
      ...(input.replyWindowHours !== undefined ? { replyWindowHours: input.replyWindowHours } : {}),
    });

    return ok(updated!);
  }
}
