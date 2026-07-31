import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { StatusUpdateInput } from '../../dtos/webhook/status-update-input.dto.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { CampaignRecipientStatus } from '../../../domain/enums/campaign-recipient-status.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';

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
    private readonly conversationRepo: ConversationRepository,
    private readonly devEvents: DeveloperEventsPort,
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

      // Webhook para desarrolladores: ciclo de vida de TODO mensaje saliente
      // (humano, bot, plantilla, campaña o flujo) según lo reporta el proveedor.
      const conversation = await this.conversationRepo.findById(message.conversationId);
      if (conversation) {
        this.devEvents.emit(conversation.tenantId, DeveloperEventType.MESSAGE_STATUS_UPDATED, {
          messageId: message.id,
          conversationId: message.conversationId,
          waMessageId: input.waMessageId,
          status: input.status,
          timestamp: input.timestamp,
          ...(input.status === 'failed' && errorInfo ? { error: errorInfo } : {}),
        });
      }
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
