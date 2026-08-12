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
import { MessageChargeRepository } from '../../../domain/repositories/message-charge.repository.js';

const RECIPIENT_STATUS_MAP: Record<string, CampaignRecipientStatus> = {
  delivered: CampaignRecipientStatus.DELIVERED,
  read: CampaignRecipientStatus.READ,
  failed: CampaignRecipientStatus.FAILED,
};

/** `read` prueba la entrega aunque el `delivered` se haya perdido. */
const DELIVERED_STATUSES = new Set(['delivered', 'read']);

export class HandleStatusUpdateUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly devEvents: DeveloperEventsPort,
    private readonly charges: MessageChargeRepository,
  ) {}

  async execute(input: StatusUpdateInput): Promise<void> {
    const firstError = input.errors?.[0];
    const errorInfo = firstError ? { code: String(firstError.code), message: firstError.title } : undefined;

    const message = await this.messageRepo.updateStatusByWaMessageId(
      input.waMessageId,
      input.status as MessageWaStatus,
      {
        occurredAt: input.timestamp,
        ...(input.status === 'failed' && errorInfo ? { error: errorInfo } : {}),
      },
    );

    // Contabilidad. Va antes de lo demás y no depende de que exista el Message:
    // el `pricing` de Meta llega pegado al `delivered`, una sola vez, y si no se
    // guarda cuando llega no hay forma de recuperarlo.
    await this.recordCharge(input, message?.conversationId ?? null);

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

  /**
   * Sella la entrega —o el fallo— en el libro contable.
   *
   * Si no hay fila de envío, el mensaje salió antes de que existiera el ledger:
   * se crea una huérfana con lo que cobró Meta en vez de tirar el dato. Para eso
   * hace falta el tenant, que sólo se puede resolver por la conversación.
   */
  private async recordCharge(input: StatusUpdateInput, conversationId: string | null): Promise<void> {
    if (input.status === 'failed') {
      await this.charges.stampFailed(
        input.waMessageId,
        input.timestamp,
        input.errors?.[0] ? String(input.errors[0].code) : null,
      );
      return;
    }

    if (!DELIVERED_STATUSES.has(input.status)) return;

    const fallback = conversationId ? await this.orphanFallback(conversationId) : undefined;
    await this.charges.stampDelivered(input.waMessageId, input.timestamp, input.pricing ?? null, fallback);
  }

  private async orphanFallback(conversationId: string) {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) return undefined;
    return {
      tenantId: conversation.tenantId,
      phoneNumberId: conversation.phoneNumberId,
      conversationId: conversation.id,
      // No sabemos quién lo escribió, y inventarlo ensuciaría los agrupados.
      senderKind: 'unknown' as const,
    };
  }
}
