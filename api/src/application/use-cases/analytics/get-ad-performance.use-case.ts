import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { MessageChargeRepository } from '../../../domain/repositories/message-charge.repository.js';

export interface AdPerformanceQueryInput {
  tenantId: string;
  from: Date;
  to: Date;
  phoneNumberId?: string;
}

export interface AdPerformanceEntry {
  sourceId: string;
  sourceType: string;
  headline: string | null;
  body: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  conversations: number;
  contacts: number;
  assigned: number;
  unread: number;
  lastAt: Date;
  messagesBillable: number;
  messagesFree: number;
  cost: number | null;
  currency: string | null;
}

export interface AdPerformanceView {
  entries: AdPerformanceEntry[];
  totals: {
    ads: number;
    conversations: number;
    contacts: number;
    assigned: number;
    unread: number;
    cost: number | null;
    currency: string | null;
  };
}

export class GetAdPerformanceUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly chargeRepo: MessageChargeRepository,
  ) {}

  async execute(query: AdPerformanceQueryInput): Promise<AdPerformanceView> {
    const [rows, usage] = await Promise.all([
      this.conversationRepo.adPerformance(query),
      this.chargeRepo.usage({
        tenantId: query.tenantId,
        from: query.from,
        to: query.to,
        phoneNumberId: query.phoneNumberId,
        groupBy: 'ad',
      }),
    ]);

    const usageBySourceId = new Map(usage.map((bucket) => [bucket.key, bucket]));

    const entries = rows.map((row) => {
      const bucket = usageBySourceId.get(row.sourceId);
      return {
        ...row,
        messagesBillable: bucket?.billable ?? 0,
        messagesFree: bucket?.free ?? 0,
        cost: bucket?.amount ?? null,
        currency: bucket?.currency ?? null,
      };
    });

    const ratedEntries = entries.filter((entry) => entry.cost !== null);

    return {
      entries,
      totals: {
        ads: entries.length,
        conversations: entries.reduce((total, entry) => total + entry.conversations, 0),
        contacts: entries.reduce((total, entry) => total + entry.contacts, 0),
        assigned: entries.reduce((total, entry) => total + entry.assigned, 0),
        unread: entries.reduce((total, entry) => total + entry.unread, 0),
        cost: ratedEntries.length
          ? Number(ratedEntries.reduce((total, entry) => total + (entry.cost ?? 0), 0).toFixed(4))
          : null,
        currency: ratedEntries.find((entry) => entry.currency)?.currency ?? null,
      },
    };
  }
}
