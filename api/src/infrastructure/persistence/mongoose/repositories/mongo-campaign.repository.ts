import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CampaignFilters,
  CampaignRepository,
  CreateCampaignInput,
} from '../../../../domain/repositories/campaign.repository.js';
import { Campaign, CampaignCounts } from '../../../../domain/entities/campaign.entity.js';
import { CampaignStatus } from '../../../../domain/enums/campaign-status.enum.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { CampaignModel, CampaignDocument } from '../schemas/campaign.schema.js';
import { CampaignMapper } from '../mappers/campaign.mapper.js';

const ACTIVE_STATUSES = [CampaignStatus.SCHEDULED, CampaignStatus.RUNNING];

@Injectable()
export class MongoCampaignRepository implements CampaignRepository {
  constructor(
    @InjectModel(CampaignModel.name) private readonly model: Model<CampaignDocument>,
  ) {}

  async create(campaign: CreateCampaignInput): Promise<Campaign> {
    const doc = await this.model.create({
      ...campaign,
      tenantId: new Types.ObjectId(campaign.tenantId),
      phoneNumberId: new Types.ObjectId(campaign.phoneNumberId),
      templateId: new Types.ObjectId(campaign.templateId),
      createdByAgentId: new Types.ObjectId(campaign.createdByAgentId),
    });
    return CampaignMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Campaign | null> {
    const doc = await this.model.findById(id);
    return doc ? CampaignMapper.toDomain(doc) : null;
  }

  async findByFilters(filters: CampaignFilters): Promise<PaginatedResult<Campaign>> {
    const query: Record<string, unknown> = { tenantId: new Types.ObjectId(filters.tenantId) };
    if (filters.status) query.status = filters.status;
    if (filters.phoneNumberId) query.phoneNumberId = new Types.ObjectId(filters.phoneNumberId);

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit),
      this.model.countDocuments(query),
    ]);

    return {
      data: docs.map(CampaignMapper.toDomain),
      meta: {
        total,
        page: filters.page,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async update(id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null> {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (['tenantId', 'phoneNumberId', 'templateId', 'createdByAgentId'].includes(key) && value) {
        updateData[key] = new Types.ObjectId(value as string);
      } else {
        updateData[key] = value;
      }
    }
    const doc = await this.model.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
    return doc ? CampaignMapper.toDomain(doc) : null;
  }

  async transitionStatus(
    id: string,
    from: CampaignStatus[],
    to: CampaignStatus,
    extra?: Partial<Pick<Campaign, 'startedAt' | 'completedAt' | 'failureReason' | 'scheduledAt'>>,
  ): Promise<Campaign | null> {
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: { $in: from } },
      { $set: { status: to, ...(extra ?? {}) } },
      { returnDocument: 'after' },
    );
    return doc ? CampaignMapper.toDomain(doc) : null;
  }

  async incrementCounts(id: string, deltas: Partial<CampaignCounts>): Promise<void> {
    const inc: Record<string, number> = {};
    for (const [key, value] of Object.entries(deltas)) {
      if (typeof value === 'number' && value !== 0) inc[`counts.${key}`] = value;
    }
    if (Object.keys(inc).length === 0) return;
    await this.model.updateOne({ _id: new Types.ObjectId(id) }, { $inc: inc });
  }

  async findRunningByTemplateId(templateId: string): Promise<Campaign[]> {
    const docs = await this.model.find({
      templateId: new Types.ObjectId(templateId),
      status: { $in: ACTIVE_STATUSES },
    });
    return docs.map(CampaignMapper.toDomain);
  }

  async countActiveByPhoneNumberId(phoneNumberId: string): Promise<number> {
    return this.model.countDocuments({
      phoneNumberId: new Types.ObjectId(phoneNumberId),
      status: { $in: ACTIVE_STATUSES },
    });
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
