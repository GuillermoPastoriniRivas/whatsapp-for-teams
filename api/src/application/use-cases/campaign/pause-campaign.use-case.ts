import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CampaignNotFoundError, InvalidCampaignStateError } from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';

export class PauseCampaignUseCase {
  constructor(private readonly campaignRepo: CampaignRepository) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<Campaign, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());

    const paused = await this.campaignRepo.transitionStatus(
      campaignId,
      [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED],
      CampaignStatus.PAUSED,
    );
    if (!paused) return err(new InvalidCampaignStateError('Only running or scheduled campaigns can be paused.'));
    return ok(paused);
  }
}
