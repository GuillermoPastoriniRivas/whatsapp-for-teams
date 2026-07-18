import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CampaignNotFoundError, InvalidCampaignStateError } from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { CampaignRecipientStatus } from '../../../domain/enums/campaign-recipient-status.enum.js';

export class CancelCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
  ) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<Campaign, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());

    const cancelled = await this.campaignRepo.transitionStatus(
      campaignId,
      [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED, CampaignStatus.RUNNING, CampaignStatus.PAUSED],
      CampaignStatus.CANCELLED,
      { completedAt: new Date() },
    );
    if (!cancelled) return err(new InvalidCampaignStateError('The campaign is already finished.'));

    const skipped = await this.recipientRepo.skipByStatuses(
      campaignId,
      [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.QUEUED],
      'Campaign cancelled',
    );
    if (skipped > 0) await this.campaignRepo.incrementCounts(campaignId, { skipped });

    return ok((await this.campaignRepo.findById(campaignId))!);
  }
}
