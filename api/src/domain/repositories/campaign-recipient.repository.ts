import { CampaignRecipient } from '../entities/campaign-recipient.entity.js';
import { CampaignRecipientStatus } from '../enums/campaign-recipient-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export interface CreateCampaignRecipientInput {
  campaignId: string;
  tenantId: string;
  contactId: string;
  waId: string;
  phone: string;
  resolvedVariables: Record<string, string>;
  status: CampaignRecipientStatus;
  failureReason?: string | null;
}

export interface CampaignStatsAggregate {
  byStatus: Record<string, number>;
  replied: number;
  failureBreakdown: Array<{ code: string; title: string; count: number }>;
}

export interface CampaignRecipientRepository {
  bulkInsert(recipients: CreateCampaignRecipientInput[]): Promise<number>;
  /** Atomically claims up to `limit` PENDING recipients (PENDING → QUEUED) and returns them. */
  claimBatch(campaignId: string, limit: number): Promise<CampaignRecipient[]>;
  /** Returns QUEUED recipients stuck since before `olderThan` back to PENDING (crash recovery). */
  resetStaleQueued(campaignId: string, olderThan: Date): Promise<number>;
  markSent(
    id: string,
    data: { waMessageId: string; messageId: string; conversationId: string; sentAt: Date; replyWindowExpiresAt: Date },
  ): Promise<void>;
  markFailed(id: string, code: string, reason: string): Promise<void>;
  markSkipped(id: string, reason: string): Promise<void>;
  /** QUEUED → PENDING with attemptCount++ and nextAttemptAt for retryable per-recipient errors. */
  scheduleRetry(id: string, nextAttemptAt: Date): Promise<void>;
  /** Returns QUEUED recipients to PENDING without consuming an attempt (rate-limit pushback). */
  requeue(ids: string[]): Promise<void>;
  /**
   * Applies a delivery status keyed by waMessageId with a monotonic guard
   * (sent < delivered < read; failed only from queued/sent). Returns the
   * updated recipient or null if no doc matched or the guard rejected it.
   */
  updateStatusByWaMessageId(
    waMessageId: string,
    status: CampaignRecipientStatus,
    at: Date,
    errorInfo?: { code: string; title: string },
  ): Promise<CampaignRecipient | null>;
  /**
   * Marks all recipients for this contact whose reply window is still open as replied.
   * Returns per-campaign counts of newly-marked recipients for stats increments.
   */
  markRepliedByContact(contactId: string, at: Date): Promise<Array<{ campaignId: string; count: number }>>;
  findByCampaignId(
    campaignId: string,
    filters: { status?: CampaignRecipientStatus; page: number; limit: number },
  ): Promise<PaginatedResult<CampaignRecipient>>;
  aggregateStats(campaignId: string): Promise<CampaignStatsAggregate>;
  countByStatuses(campaignId: string, statuses: CampaignRecipientStatus[]): Promise<number>;
  /** Bulk-skips recipients in the given statuses (campaign cancelled / template revoked). */
  skipByStatuses(campaignId: string, statuses: CampaignRecipientStatus[], reason: string): Promise<number>;
  deleteByCampaignId(campaignId: string): Promise<void>;
}
