import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConversationRepository,
  ConversationFilters,
  PaginatedResult,
  FindOrCreateResult,
} from '../../../../domain/repositories/conversation.repository.js';
import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';
import { ConversationOrigin } from '../../../../domain/enums/conversation-origin.enum.js';
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
      origin: data.origin,
      hasReplied: data.hasReplied,
      repliedAt: data.repliedAt,
    });
    return ConversationMapper.toDomain(doc);
  }

  async findOrCreateByContactAndPhone(
    data: Omit<Conversation, 'id' | 'createdAt' | 'resolvedAt' | 'closedBy' | 'summary'>,
  ): Promise<FindOrCreateResult> {
    const result = await this.model.findOneAndUpdate(
      {
        contactId: new Types.ObjectId(data.contactId),
        phoneNumberId: new Types.ObjectId(data.phoneNumberId),
      },
      {
        $setOnInsert: {
          tenantId: new Types.ObjectId(data.tenantId),
          phoneNumberId: new Types.ObjectId(data.phoneNumberId),
          contactId: new Types.ObjectId(data.contactId),
          agentId: data.agentId ? new Types.ObjectId(data.agentId) : null,
          status: data.status,
          lastMessageAt: data.lastMessageAt,
          lastInboundAt: data.lastInboundAt,
          origin: data.origin,
          hasReplied: data.hasReplied,
          repliedAt: data.repliedAt,
        },
      },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true },
    );
    const doc = result.value!;
    const created = !!result.lastErrorObject?.upserted;
    return { conversation: ConversationMapper.toDomain(doc), created };
  }

  async findById(id: string): Promise<Conversation | null> {
    const doc = await this.model.findById(id);
    return doc ? ConversationMapper.toDomain(doc) : null;
  }

  async findOpenByContactAndPhone(contactId: string, phoneNumberId: string): Promise<Conversation | null> {
    const doc = await this.model.findOne({
      contactId: new Types.ObjectId(contactId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
    });
    return doc ? ConversationMapper.toDomain(doc) : null;
  }

  async findByContactAndPhone(contactId: string, phoneNumberId: string): Promise<Conversation | null> {
    const doc = await this.model.findOne(
      {
        contactId: new Types.ObjectId(contactId),
        phoneNumberId: new Types.ObjectId(phoneNumberId),
      },
      null,
      { sort: { lastMessageAt: -1 } },
    );
    return doc ? ConversationMapper.toDomain(doc) : null;
  }

  async findByFilters(filters: ConversationFilters): Promise<PaginatedResult<Conversation>> {
    const query: Record<string, unknown> = { tenantId: new Types.ObjectId(filters.tenantId) };
    if (filters.status) query.status = filters.status;
    if (filters.agentId) query.agentId = new Types.ObjectId(filters.agentId);
    if (filters.phoneNumberId) query.phoneNumberId = new Types.ObjectId(filters.phoneNumberId);

    // 'inbox' (default) hides campaign conversations the contact never replied to;
    // 'campaign' shows only those; 'all' applies no origin filter.
    // Docs created before this field existed have no `origin`, so they never match
    // { origin: 'campaign' } and stay visible in the inbox without a backfill.
    const view = filters.view ?? 'inbox';
    if (view === 'inbox') {
      query.$nor = [{ origin: ConversationOrigin.CAMPAIGN, hasReplied: false }];
    } else if (view === 'campaign') {
      query.origin = ConversationOrigin.CAMPAIGN;
      query.hasReplied = false;
    }

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
    const doc = await this.model.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
    return doc ? ConversationMapper.toDomain(doc) : null;
  }

  async countByTenantIdSince(tenantId: string, since: Date): Promise<number> {
    return this.model.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      createdAt: { $gte: since },
    });
  }
}
