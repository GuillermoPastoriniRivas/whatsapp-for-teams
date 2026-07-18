import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { StatusUpdateInput } from '../../dtos/webhook/status-update-input.dto.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { CampaignRecipientStatus } from '../../../domain/enums/campaign-recipient-status.enum.js';

const RECIPIENT_STATUS_MAP: Record<string, CampaignRecipientStatus> = {
  delivered: CampaignRecipientStatus.DELIVERED,
  read: CampaignRecipientStatus.READ,
  failed: CampaignRecipientStatus.FAILED,
};

export class HandleStatusUpdateUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
  ) {}

  async execute(input: StatusUpdateInput): Promise<void> {
    const firstError = input.errors?.[0];
    const errorInfo = firstError ? { code: String(firstError.code), message: firstError.title } : undefined;

    const message = await this.messageRepo.updateStatusByWaMessageId(
      input.waMessageId,
      input.status as MessageWaStatus,
      input.status === 'failed' ? errorInfo : undefined,
    );

    if (message) {
      this.gateway.emitToConversation(message.conversationId, 'message.status', {
        waMessageId: input.waMessageId,
        waStatus: input.status,
        ...(input.status === 'failed' && errorInfo ? { error: errorInfo } : {}),
      });
    }

    // Campaign recipient tracking. The monotonic guard in the repo makes
    // out-of-order webhooks a no-op, so counters increment exactly once.
    const recipientStatus = RECIPIENT_STATUS_MAP[input.status];
    if (!recipientStatus) return;

    const recipient = await this.recipientRepo.updateStatusByWaMessageId(
      input.waMessageId,
      recipientStatus,
      input.timestamp,
      firstError ? { code: String(firstError.code), title: firstError.title } : undefined,
    );
    if (!recipient) return;

    await this.campaignRepo.incrementCounts(recipient.campaignId, { [input.status]: 1 });

    const campaign = await this.campaignRepo.findById(recipient.campaignId);
    if (campaign) {
      this.gateway.emitToTenant(campaign.tenantId, 'campaign.progress', {
        campaignId: campaign.id,
        counts: campaign.counts,
      });
    }
  }
}
