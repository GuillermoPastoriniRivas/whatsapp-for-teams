import { Logger } from '@nestjs/common';
import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { CampaignRecipientStatus } from '../../../domain/enums/campaign-recipient-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationOrigin } from '../../../domain/enums/conversation-origin.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { CampaignRecipient } from '../../../domain/entities/campaign-recipient.entity.js';
import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { buildTemplatePayload } from './helpers/template-variable.resolver.js';
import { CAMPAIGN_DISPATCH_JOB } from './start-campaign.use-case.js';

const STALE_QUEUED_MS = 10 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
const NEXT_ATTEMPT_POLL_MS = 30 * 1000;
const STATUS_RECHECK_EVERY = 10;
const MAX_SEND_ATTEMPTS = 3;

/**
 * Error shape thrown by the Meta HTTP layer (infrastructure). Duck-typed here
 * so the application layer does not import from infrastructure.
 */
interface ClassifiedError {
  severity?: 'rate_limit' | 'recipient' | 'campaign';
  retryable?: boolean;
  code?: number;
  message?: string;
}

/**
 * Sends one batch of a campaign, then re-schedules itself until no
 * PENDING/QUEUED recipients remain. Pause/cancel simply flip the campaign
 * status; the next status check kills the loop without touching Agenda.
 */
export class ProcessCampaignBatchUseCase {
  private readonly logger = new Logger(ProcessCampaignBatchUseCase.name);

  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly messagingApi: MessagingApiPort,
    private readonly jobQueue: JobQueuePort,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: { campaignId: string }): Promise<void> {
    const { campaignId } = input;
    let campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) return;

    // A scheduled dispatch firing at scheduledAt promotes the campaign to RUNNING.
    if (campaign.status === CampaignStatus.SCHEDULED) {
      const started = await this.campaignRepo.transitionStatus(campaignId, [CampaignStatus.SCHEDULED], CampaignStatus.RUNNING, {
        startedAt: campaign.startedAt ?? new Date(),
      });
      if (!started) return;
      campaign = started;
      this.emitProgress(campaign, { status: campaign.status });
    }

    if (campaign.status !== CampaignStatus.RUNNING) return;

    // Re-validate the template — Meta may have paused/disabled it mid-campaign.
    const template = await this.templateRepo.findById(campaign.templateId);
    if (!template || template.status !== TemplateStatus.APPROVED) {
      await this.pauseWithReason(campaign, `Template is not approved (${template?.status ?? 'deleted'})`);
      return;
    }

    const phone = await this.phoneRepo.findById(campaign.phoneNumberId);
    if (!phone || phone.status !== 'active') {
      await this.pauseWithReason(campaign, 'Phone number is inactive');
      return;
    }

    // Crash recovery: recipients claimed by a worker that died return to PENDING.
    await this.recipientRepo.resetStaleQueued(campaignId, new Date(Date.now() - STALE_QUEUED_MS));

    const batch = await this.recipientRepo.claimBatch(campaignId, campaign.throttle.batchSize);

    if (batch.length === 0) {
      const remaining = await this.recipientRepo.countByStatuses(campaignId, [
        CampaignRecipientStatus.PENDING,
        CampaignRecipientStatus.QUEUED,
      ]);
      if (remaining === 0) {
        const completed = await this.campaignRepo.transitionStatus(campaignId, [CampaignStatus.RUNNING], CampaignStatus.COMPLETED, {
          completedAt: new Date(),
        });
        if (completed) this.emitProgress(completed, { status: completed.status });
      } else {
        // Recipients exist but are waiting on nextAttemptAt — poll again shortly.
        await this.jobQueue.schedule(CAMPAIGN_DISPATCH_JOB, { campaignId }, new Date(Date.now() + NEXT_ATTEMPT_POLL_MS));
      }
      return;
    }

    const delayMs = Math.max(25, Math.floor(1000 / Math.max(1, campaign.throttle.messagesPerSecond)));

    for (let i = 0; i < batch.length; i++) {
      // Cut the batch short if the campaign was paused/cancelled mid-flight.
      if (i > 0 && i % STATUS_RECHECK_EVERY === 0) {
        const fresh = await this.campaignRepo.findById(campaignId);
        if (!fresh || fresh.status !== CampaignStatus.RUNNING) {
          await this.recipientRepo.requeue(batch.slice(i).map((r) => r.id));
          return;
        }
      }

      const stop = await this.sendToRecipient(campaign, template, phone, batch[i], batch.slice(i + 1));
      if (stop) return;

      if (i < batch.length - 1) await sleep(delayMs);
    }

    this.emitProgress(campaign, {});

    // More work may remain — continue with the next batch.
    await this.jobQueue.schedule(CAMPAIGN_DISPATCH_JOB, { campaignId }, new Date());
  }

  /** Returns true when the whole dispatch loop must stop (rate limit / campaign-level failure). */
  private async sendToRecipient(
    campaign: Campaign,
    template: MessageTemplate,
    phone: PhoneNumber,
    recipient: CampaignRecipient,
    rest: CampaignRecipient[],
  ): Promise<boolean> {
    const built = buildTemplatePayload(template.components, recipient.resolvedVariables);

    try {
      const { waMessageId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        to: recipient.waId,
        type: 'template',
        template: {
          name: template.name,
          language: template.language,
          components: built.components,
        },
      });

      const now = new Date();

      // Campaign conversations are born hidden from the inbox (origin=campaign,
      // hasReplied=false) and with an expired 24h window (epoch lastInboundAt).
      // If a conversation already exists for this contact+phone, $setOnInsert
      // leaves it untouched.
      const { conversation } = await this.conversationRepo.findOrCreateByContactAndPhone({
        tenantId: campaign.tenantId,
        phoneNumberId: campaign.phoneNumberId,
        contactId: recipient.contactId,
        agentId: null,
        status: ConversationStatus.UNASSIGNED,
        lastMessageAt: now,
        lastInboundAt: new Date(0),
        pendingAiSince: null,
        origin: ConversationOrigin.CAMPAIGN,
        hasReplied: false,
        repliedAt: null,
      });

      const message = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.TEMPLATE,
        body: built.renderedBody,
        mediaUrl: null,
        mimeType: null,
        waMessageId,
        waStatus: MessageWaStatus.SENT,
        timestamp: now,
        senderAgentId: campaign.createdByAgentId,
        senderAgentName: null,
        campaignId: campaign.id,
      });

      await this.recipientRepo.markSent(recipient.id, {
        waMessageId,
        messageId: message.id,
        conversationId: conversation.id,
        sentAt: now,
        replyWindowExpiresAt: new Date(now.getTime() + campaign.replyWindowHours * 60 * 60 * 1000),
      });
      await this.campaignRepo.incrementCounts(campaign.id, { sent: 1 });
      await this.conversationRepo.update(conversation.id, { lastMessageAt: now } as Partial<typeof conversation>);
      return false;
    } catch (error) {
      return this.handleSendError(campaign, recipient, rest, error as ClassifiedError);
    }
  }

  private async handleSendError(
    campaign: Campaign,
    recipient: CampaignRecipient,
    rest: CampaignRecipient[],
    error: ClassifiedError,
  ): Promise<boolean> {
    const message = error?.message ?? 'Send failed';

    if (error?.severity === 'rate_limit') {
      // Back off without consuming attempts; the whole batch waits.
      this.logger.warn(`Campaign ${campaign.id}: rate limited by Meta, backing off ${RATE_LIMIT_BACKOFF_MS}ms`);
      await this.recipientRepo.requeue([recipient.id, ...rest.map((r) => r.id)]);
      await this.jobQueue.schedule(CAMPAIGN_DISPATCH_JOB, { campaignId: campaign.id }, new Date(Date.now() + RATE_LIMIT_BACKOFF_MS));
      return true;
    }

    if (error?.severity === 'campaign') {
      // Token/template-level failure: nothing else in this campaign can send.
      this.logger.error(`Campaign ${campaign.id}: campaign-level Meta error — ${message}`);
      await this.recipientRepo.requeue([recipient.id, ...rest.map((r) => r.id)]);
      const paused = await this.campaignRepo.transitionStatus(campaign.id, [CampaignStatus.RUNNING], CampaignStatus.PAUSED, {
        failureReason: message,
      });
      if (paused) this.emitProgress(paused, { status: paused.status, failureReason: message });
      return true;
    }

    if (error?.severity === 'recipient') {
      await this.recipientRepo.markFailed(recipient.id, String(error.code ?? 'unknown'), message);
      await this.campaignRepo.incrementCounts(campaign.id, { failed: 1 });
      return false;
    }

    // Unknown error (network hiccup, provider glitch): retry with backoff, then fail.
    if (recipient.attemptCount + 1 < MAX_SEND_ATTEMPTS) {
      await this.recipientRepo.scheduleRetry(recipient.id, new Date(Date.now() + RETRY_BACKOFF_MS));
    } else {
      await this.recipientRepo.markFailed(recipient.id, String(error?.code ?? 'unknown'), message);
      await this.campaignRepo.incrementCounts(campaign.id, { failed: 1 });
    }
    return false;
  }

  private async pauseWithReason(campaign: Campaign, reason: string): Promise<void> {
    const paused = await this.campaignRepo.transitionStatus(campaign.id, [CampaignStatus.RUNNING], CampaignStatus.PAUSED, {
      failureReason: reason,
    });
    if (paused) this.emitProgress(paused, { status: paused.status, failureReason: reason });
  }

  private emitProgress(campaign: Campaign, extra: Record<string, unknown>): void {
    this.gateway.emitToTenant(campaign.tenantId, 'campaign.progress', { campaignId: campaign.id, ...extra });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
