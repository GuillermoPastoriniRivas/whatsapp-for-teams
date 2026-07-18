import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignFilters, CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';

export class ListCampaignsUseCase {
  constructor(private readonly campaignRepo: CampaignRepository) {}

  async execute(filters: CampaignFilters): Promise<PaginatedResult<Campaign>> {
    return this.campaignRepo.findByFilters(filters);
  }
}
