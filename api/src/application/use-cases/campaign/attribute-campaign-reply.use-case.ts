import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';

/**
 * Called on every inbound message: marks this contact's campaign sends
 * (whose attribution window is still open) as replied and bumps the
 * per-campaign replied counters.
 */
export class AttributeCampaignReplyUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(contactId: string, at: Date): Promise<void> {
    const marked = await this.recipientRepo.markRepliedByContact(contactId, at);
    for (const { campaignId, count } of marked) {
      await this.campaignRepo.incrementCounts(campaignId, { replied: count });
      const campaign = await this.campaignRepo.findById(campaignId);
      if (campaign) {
        this.gateway.emitToTenant(campaign.tenantId, 'campaign.progress', {
          campaignId,
          replied: campaign.counts.replied,
        });
      }
    }
  }
}
