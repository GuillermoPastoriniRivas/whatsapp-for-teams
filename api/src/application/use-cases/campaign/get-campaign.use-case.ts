import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CampaignNotFoundError } from '../../../domain/errors/domain-errors.js';

export class GetCampaignUseCase {
  constructor(private readonly campaignRepo: CampaignRepository) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<Campaign, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());
    return ok(campaign);
  }
}
