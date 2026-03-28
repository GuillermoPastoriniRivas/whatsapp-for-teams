import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationEventRepository } from '../../../../domain/repositories/conversation-event.repository.js';
import { ConversationEvent } from '../../../../domain/entities/conversation-event.entity.js';
import { ConversationEventModel, ConversationEventDocument } from '../schemas/conversation-event.schema.js';
import { ConversationEventMapper } from '../mappers/conversation-event.mapper.js';

@Injectable()
export class MongoConversationEventRepository implements ConversationEventRepository {
  constructor(
    @InjectModel(ConversationEventModel.name) private readonly model: Model<ConversationEventDocument>,
  ) {}

  async create(data: Omit<ConversationEvent, 'id' | 'createdAt'>): Promise<ConversationEvent> {
    const doc = await this.model.create({
      conversationId: new Types.ObjectId(data.conversationId),
      tenantId: new Types.ObjectId(data.tenantId),
      type: data.type,
      performedBy: data.performedBy,
      data: data.data,
    });
    return ConversationEventMapper.toDomain(doc);
  }

  async findByConversationId(conversationId: string): Promise<ConversationEvent[]> {
    const docs = await this.model
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 });
    return docs.map(ConversationEventMapper.toDomain);
  }
}
