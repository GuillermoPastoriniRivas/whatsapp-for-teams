import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConversationRepository,
  ConversationFilters,
  PaginatedResult,
} from '../../../../domain/repositories/conversation.repository.js';
import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';
import { ConversationModel, ConversationDocument } from '../schemas/conversation.schema.js';
import { ConversationMapper } from '../mappers/conversation.mapper.js';

@Injectable()
export class MongoConversationRepository implements ConversationRepository {
  constructor(
    @InjectModel(ConversationModel.name) private readonly model: Model<ConversationDocument>,
  ) {}

  async create(data: Omit<Conversation, 'id' | 'createdAt' | 'resolvedAt' | 'closedBy'>): Promise<Conversation> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      phoneNumberId: new Types.ObjectId(data.phoneNumberId),
      contactId: new Types.ObjectId(data.contactId),
      agentId: data.agentId ? new Types.ObjectId(data.agentId) : null,
      status: data.status,
      lastMessageAt: data.lastMessageAt,
      lastInboundAt: data.lastInboundAt,
    });
    return ConversationMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Conversation | null> {
    const doc = await this.model.findById(id);
    return doc ? ConversationMapper.toDomain(doc) : null;
  }

  async findOpenByContactAndPhone(contactId: string, phoneNumberId: string): Promise<Conversation | null> {
    const doc = await this.model.findOne({
      contactId: new Types.ObjectId(contactId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
      status: { $ne: ConversationStatus.RESOLVED },
    });
    return doc ? ConversationMapper.toDomain(doc) : null;
  }

  async findByFilters(filters: ConversationFilters): Promise<PaginatedResult<Conversation>> {
    const query: Record<string, unknown> = { tenantId: new Types.ObjectId(filters.tenantId) };
    if (filters.status) query.status = filters.status;
    if (filters.agentId) query.agentId = new Types.ObjectId(filters.agentId);
    if (filters.phoneNumberId) query.phoneNumberId = new Types.ObjectId(filters.phoneNumberId);

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ lastMessageAt: -1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit),
      this.model.countDocuments(query),
    ]);

    return {
      data: docs.map(ConversationMapper.toDomain),
      meta: {
        total,
        page: filters.page,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findActiveByAgentId(agentId: string): Promise<Conversation[]> {
    const docs = await this.model.find({
      agentId: new Types.ObjectId(agentId),
      status: ConversationStatus.ACTIVE,
    });
    return docs.map(ConversationMapper.toDomain);
  }

  async findActiveByAgentAndPhone(agentId: string, phoneNumberId: string): Promise<Conversation[]> {
    const docs = await this.model.find({
      agentId: new Types.ObjectId(agentId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
      status: ConversationStatus.ACTIVE,
    });
    return docs.map(ConversationMapper.toDomain);
  }

  async update(id: string, data: Partial<Conversation>): Promise<Conversation | null> {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      if (['tenantId', 'phoneNumberId', 'contactId', 'agentId'].includes(key) && value) {
        updateData[key] = new Types.ObjectId(value as string);
      } else {
        updateData[key] = value;
      }
    }
    const doc = await this.model.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    return doc ? ConversationMapper.toDomain(doc) : null;
  }
}
