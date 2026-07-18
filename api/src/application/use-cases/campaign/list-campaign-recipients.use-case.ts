import { CampaignRecipient } from '../../../domain/entities/campaign-recipient.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { CampaignRecipientStatus } from '../../../domain/enums/campaign-recipient-status.enum.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CampaignNotFoundError } from '../../../domain/errors/domain-errors.js';

export class ListCampaignRecipientsUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
  ) {}

  async execute(
    tenantId: string,
    campaignId: string,
    filters: { status?: CampaignRecipientStatus; page: number; limit: number },
  ): Promise<Result<PaginatedResult<CampaignRecipient>, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());
    return ok(await this.recipientRepo.findByCampaignId(campaignId, filters));
  }
}
