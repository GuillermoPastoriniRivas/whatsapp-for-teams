import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  CampaignRecipientRepository,
  CampaignStatsAggregate,
  CreateCampaignRecipientInput,
} from '../../../../domain/repositories/campaign-recipient.repository.js';
import { CampaignRecipient } from '../../../../domain/entities/campaign-recipient.entity.js';
import { CampaignRecipientStatus } from '../../../../domain/enums/campaign-recipient-status.enum.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { CampaignRecipientModel, CampaignRecipientDocument } from '../schemas/campaign-recipient.schema.js';
import { CampaignRecipientMapper } from '../mappers/campaign-recipient.mapper.js';

const REPLYABLE_STATUSES = [
  CampaignRecipientStatus.SENT,
  CampaignRecipientStatus.DELIVERED,
  CampaignRecipientStatus.READ,
];

@Injectable()
export class MongoCampaignRecipientRepository implements CampaignRecipientRepository {
  constructor(
    @InjectModel(CampaignRecipientModel.name) private readonly model: Model<CampaignRecipientDocument>,
  ) {}

  async bulkInsert(recipients: CreateCampaignRecipientInput[]): Promise<number> {
    if (recipients.length === 0) return 0;
    try {
      const docs = await this.model.insertMany(
        recipients.map((r) => ({
          ...r,
          campaignId: new Types.ObjectId(r.campaignId),
          tenantId: new Types.ObjectId(r.tenantId),
          contactId: new Types.ObjectId(r.contactId),
        })),
        { ordered: false },
      );
      return docs.length;
    } catch (error: any) {
      // ordered:false keeps inserting past duplicates (unique {campaignId, contactId});
      // Mongo reports the successful count in the bulk-write error result.
      if (error?.insertedDocs) return error.insertedDocs.length;
      throw error;
    }
  }

  async claimBatch(campaignId: string, limit: number): Promise<CampaignRecipient[]> {
    const now = new Date();
    const candidates = await this.model
      .find({
        campaignId: new Types.ObjectId(campaignId),
        status: CampaignRecipientStatus.PENDING,
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
      })
      .sort({ _id: 1 })
      .limit(limit)
      .select('_id');

    if (candidates.length === 0) return [];

    // Claim with a unique token so concurrent workers can never both
    // treat the same recipient as theirs (the status filter makes the
    // claim exclusive; the token identifies exactly which docs we won).
    const claimToken = randomUUID();
    await this.model.updateMany(
      { _id: { $in: candidates.map((c) => c._id) }, status: CampaignRecipientStatus.PENDING },
      { $set: { status: CampaignRecipientStatus.QUEUED, claimToken } },
    );

    const claimed = await this.model.find({ claimToken }).sort({ _id: 1 });
    return claimed.map(CampaignRecipientMapper.toDomain);
  }

  async resetStaleQueued(campaignId: string, olderThan: Date): Promise<number> {
    const result = await this.model.updateMany(
      {
        campaignId: new Types.ObjectId(campaignId),
        status: CampaignRecipientStatus.QUEUED,
        updatedAt: { $lt: olderThan },
      },
      { $set: { status: CampaignRecipientStatus.PENDING, claimToken: null } },
    );
    return result.modifiedCount;
  }

  async markSent(
    id: string,
    data: { waMessageId: string; messageId: string; conversationId: string; sentAt: Date; replyWindowExpiresAt: Date },
  ): Promise<void> {
    await this.model.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: {
          status: CampaignRecipientStatus.SENT,
          waMessageId: data.waMessageId,
          messageId: new Types.ObjectId(data.messageId),
          conversationId: new Types.ObjectId(data.conversationId),
          sentAt: data.sentAt,
          replyWindowExpiresAt: data.replyWindowExpiresAt,
          claimToken: null,
        },
      },
    );
  }

  async markFailed(id: string, code: string, reason: string): Promise<void> {
    await this.model.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: {
          status: CampaignRecipientStatus.FAILED,
          failureCode: code,
          failureReason: reason,
          claimToken: null,
        },
      },
    );
  }

  async markSkipped(id: string, reason: string): Promise<void> {
    await this.model.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { status: CampaignRecipientStatus.SKIPPED, failureReason: reason, claimToken: null } },
    );
  }

  async scheduleRetry(id: string, nextAttemptAt: Date): Promise<void> {
    await this.model.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: { status: CampaignRecipientStatus.PENDING, nextAttemptAt, claimToken: null },
        $inc: { attemptCount: 1 },
      },
    );
  }

  async requeue(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.model.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) }, status: CampaignRecipientStatus.QUEUED },
      { $set: { status: CampaignRecipientStatus.PENDING, claimToken: null } },
    );
  }

  async updateStatusByWaMessageId(
    waMessageId: string,
    status: CampaignRecipientStatus,
    at: Date,
    errorInfo?: { code: string; title: string },
  ): Promise<CampaignRecipient | null> {
    // Monotonic guard: statuses only move forward, so late/out-of-order
    // webhooks can never regress a recipient or double-increment counters.
    let allowedFrom: CampaignRecipientStatus[];
    const set: Record<string, unknown> = { status };

    switch (status) {
      case CampaignRecipientStatus.DELIVERED:
        allowedFrom = [CampaignRecipientStatus.SENT];
        set.deliveredAt = at;
        break;
      case CampaignRecipientStatus.READ:
        allowedFrom = [CampaignRecipientStatus.SENT, CampaignRecipientStatus.DELIVERED];
        set.readAt = at;
        break;
      case CampaignRecipientStatus.FAILED:
        allowedFrom = [CampaignRecipientStatus.QUEUED, CampaignRecipientStatus.SENT];
        if (errorInfo) {
          set.failureCode = errorInfo.code;
          set.failureReason = errorInfo.title;
        }
        break;
      default:
        return null;
    }

    const doc = await this.model.findOneAndUpdate(
      { waMessageId, status: { $in: allowedFrom } },
      { $set: set },
      { returnDocument: 'after' },
    );
    return doc ? CampaignRecipientMapper.toDomain(doc) : null;
  }

  async markRepliedByContact(contactId: string, at: Date): Promise<Array<{ campaignId: string; count: number }>> {
    const filter = {
      contactId: new Types.ObjectId(contactId),
      repliedAt: null,
      status: { $in: REPLYABLE_STATUSES },
      replyWindowExpiresAt: { $gte: at },
    };

    const campaignIds: Types.ObjectId[] = await this.model.distinct('campaignId', filter);
    const results: Array<{ campaignId: string; count: number }> = [];

    for (const campaignId of campaignIds) {
      const result = await this.model.updateMany({ ...filter, campaignId }, { $set: { repliedAt: at } });
      if (result.modifiedCount > 0) {
        results.push({ campaignId: campaignId.toHexString(), count: result.modifiedCount });
      }
    }
    return results;
  }

  async findByCampaignId(
    campaignId: string,
    filters: { status?: CampaignRecipientStatus; page: number; limit: number },
  ): Promise<PaginatedResult<CampaignRecipient>> {
    const query: Record<string, unknown> = { campaignId: new Types.ObjectId(campaignId) };
    if (filters.status) query.status = filters.status;

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ _id: 1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit),
      this.model.countDocuments(query),
    ]);

    return {
      data: docs.map(CampaignRecipientMapper.toDomain),
      meta: {
        total,
        page: filters.page,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async aggregateStats(campaignId: string): Promise<CampaignStatsAggregate> {
    const campaignObjectId = new Types.ObjectId(campaignId);

    const [byStatusAgg, repliedCount, failureAgg] = await Promise.all([
      this.model.aggregate<{ _id: string; count: number }>([
        { $match: { campaignId: campaignObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.model.countDocuments({ campaignId: campaignObjectId, repliedAt: { $ne: null } }),
      this.model.aggregate<{ _id: string | null; title: string | null; count: number }>([
        { $match: { campaignId: campaignObjectId, status: CampaignRecipientStatus.FAILED } },
        { $group: { _id: '$failureCode', title: { $first: '$failureReason' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusAgg) byStatus[row._id] = row.count;

    return {
      byStatus,
      replied: repliedCount,
      failureBreakdown: failureAgg.map((row) => ({
        code: row._id ?? 'unknown',
        title: row.title ?? 'Unknown error',
        count: row.count,
      })),
    };
  }

  async countByStatuses(campaignId: string, statuses: CampaignRecipientStatus[]): Promise<number> {
    return this.model.countDocuments({
      campaignId: new Types.ObjectId(campaignId),
      status: { $in: statuses },
    });
  }

  async skipByStatuses(campaignId: string, statuses: CampaignRecipientStatus[], reason: string): Promise<number> {
    const result = await this.model.updateMany(
      { campaignId: new Types.ObjectId(campaignId), status: { $in: statuses } },
      { $set: { status: CampaignRecipientStatus.SKIPPED, failureReason: reason, claimToken: null } },
    );
    return result.modifiedCount;
  }

  async deleteByCampaignId(campaignId: string): Promise<void> {
    await this.model.deleteMany({ campaignId: new Types.ObjectId(campaignId) });
  }
}
