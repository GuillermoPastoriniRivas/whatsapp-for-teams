import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CampaignNotFoundError, InvalidCampaignStateError } from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';

const DELETABLE_STATUSES = [CampaignStatus.DRAFT, CampaignStatus.CANCELLED];

export class DeleteCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
  ) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<void, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());
    if (!DELETABLE_STATUSES.includes(campaign.status)) {
      return err(new InvalidCampaignStateError('Only draft or cancelled campaigns can be deleted.'));
    }

    await this.recipientRepo.deleteByCampaignId(campaignId);
    await this.campaignRepo.delete(campaignId);
    return ok(undefined);
  }
}
