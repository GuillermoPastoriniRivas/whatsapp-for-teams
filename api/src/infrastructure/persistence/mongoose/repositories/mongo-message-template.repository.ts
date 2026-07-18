import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateMessageTemplateInput,
  MessageTemplateFilters,
  MessageTemplateRepository,
} from '../../../../domain/repositories/message-template.repository.js';
import { MessageTemplate } from '../../../../domain/entities/message-template.entity.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { MessageTemplateModel, MessageTemplateDocument } from '../schemas/message-template.schema.js';
import { MessageTemplateMapper } from '../mappers/message-template.mapper.js';

@Injectable()
export class MongoMessageTemplateRepository implements MessageTemplateRepository {
  constructor(
    @InjectModel(MessageTemplateModel.name) private readonly model: Model<MessageTemplateDocument>,
  ) {}

  async create(template: CreateMessageTemplateInput): Promise<MessageTemplate> {
    const doc = await this.model.create({
      ...template,
      components: template.components as unknown as Record<string, unknown>[],
      tenantId: new Types.ObjectId(template.tenantId),
      phoneNumberId: new Types.ObjectId(template.phoneNumberId),
    });
    return MessageTemplateMapper.toDomain(doc);
  }

  async findById(id: string): Promise<MessageTemplate | null> {
    const doc = await this.model.findById(id);
    return doc ? MessageTemplateMapper.toDomain(doc) : null;
  }

  async findByFilters(filters: MessageTemplateFilters): Promise<PaginatedResult<MessageTemplate>> {
    const query: Record<string, unknown> = { tenantId: new Types.ObjectId(filters.tenantId) };
    if (filters.phoneNumberId) query.phoneNumberId = new Types.ObjectId(filters.phoneNumberId);
    if (filters.status) query.status = filters.status;
    if (filters.search) query.name = { $regex: filters.search, $options: 'i' };

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit),
      this.model.countDocuments(query),
    ]);

    return {
      data: docs.map(MessageTemplateMapper.toDomain),
      meta: {
        total,
        page: filters.page,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findByMetaTemplateId(metaTemplateId: string): Promise<MessageTemplate | null> {
    const doc = await this.model.findOne({ metaTemplateId });
    return doc ? MessageTemplateMapper.toDomain(doc) : null;
  }

  async findByWabaNameLanguage(wabaId: string, name: string, language: string): Promise<MessageTemplate | null> {
    const doc = await this.model.findOne({ wabaId, name, language });
    return doc ? MessageTemplateMapper.toDomain(doc) : null;
  }

  async update(
    id: string,
    data: Partial<Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MessageTemplate | null> {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (['tenantId', 'phoneNumberId'].includes(key) && value) {
        updateData[key] = new Types.ObjectId(value as string);
      } else {
        updateData[key] = value;
      }
    }
    const doc = await this.model.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
    return doc ? MessageTemplateMapper.toDomain(doc) : null;
  }

  async upsertFromSync(template: CreateMessageTemplateInput): Promise<MessageTemplate> {
    const doc = await this.model.findOneAndUpdate(
      { wabaId: template.wabaId, name: template.name, language: template.language },
      {
        $set: {
          metaTemplateId: template.metaTemplateId,
          category: template.category,
          status: template.status,
          qualityScore: template.qualityScore,
          components: template.components,
          rejectionReason: template.rejectionReason,
          lastSyncedAt: template.lastSyncedAt,
        },
        $setOnInsert: {
          tenantId: new Types.ObjectId(template.tenantId),
          phoneNumberId: new Types.ObjectId(template.phoneNumberId),
          wabaId: template.wabaId,
          name: template.name,
          language: template.language,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return MessageTemplateMapper.toDomain(doc!);
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
