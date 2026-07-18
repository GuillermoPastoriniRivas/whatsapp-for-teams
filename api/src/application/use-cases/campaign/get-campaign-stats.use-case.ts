import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository } from '../../../domain/repositories/campaign-recipient.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CampaignNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface CampaignStats {
  counts: {
    total: number;
    pending: number;
    queued: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    skipped: number;
    replied: number;
  };
  /** delivered+read over attempted (sent+delivered+read+failed). */
  deliveredRate: number;
  /** read over delivered+read. */
  readRate: number;
  /** replied over delivered+read — the campaign's response rate. */
  responseRate: number;
  failureBreakdown: Array<{ code: string; title: string; count: number }>;
}

export class GetCampaignStatsUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
  ) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<CampaignStats, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());

    // Recipients are the source of truth; campaign.counts is only a
    // denormalized cache for list views.
    const aggregate = await this.recipientRepo.aggregateStats(campaignId);
    const s = aggregate.byStatus;
    const get = (key: string) => s[key] ?? 0;

    const sent = get('sent');
    const delivered = get('delivered');
    const read = get('read');
    const failed = get('failed');
    const attempted = sent + delivered + read + failed;
    const reached = delivered + read;

    const counts = {
      total: attempted + get('pending') + get('queued') + get('skipped'),
      pending: get('pending'),
      queued: get('queued'),
      sent,
      delivered,
      read,
      failed,
      skipped: get('skipped'),
      replied: aggregate.replied,
    };

    return ok({
      counts,
      deliveredRate: attempted > 0 ? round(reached / attempted) : 0,
      readRate: reached > 0 ? round(read / reached) : 0,
      responseRate: reached > 0 ? round(aggregate.replied / reached) : 0,
      failureBreakdown: aggregate.failureBreakdown,
    });
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
