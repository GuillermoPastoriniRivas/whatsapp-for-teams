import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationLabelRepository } from '../../../../domain/repositories/conversation-label.repository.js';
import { ConversationLabel } from '../../../../domain/entities/conversation-label.entity.js';
import { ConversationLabelModel, ConversationLabelDocument } from '../schemas/conversation-label.schema.js';
import { ConversationLabelMapper } from '../mappers/conversation-label.mapper.js';

@Injectable()
export class MongoConversationLabelRepository implements ConversationLabelRepository {
  constructor(
    @InjectModel(ConversationLabelModel.name) private readonly model: Model<ConversationLabelDocument>,
  ) {}

  async create(data: Omit<ConversationLabel, 'id' | 'createdAt'>): Promise<ConversationLabel> {
    const doc = await this.model.create({
      conversationId: new Types.ObjectId(data.conversationId),
      tenantId: new Types.ObjectId(data.tenantId),
      labelId: new Types.ObjectId(data.labelId),
      assignedBy: data.assignedBy,
    });
    return ConversationLabelMapper.toDomain(doc);
  }

  async delete(conversationId: string, labelId: string): Promise<void> {
    await this.model.deleteOne({
      conversationId: new Types.ObjectId(conversationId),
      labelId: new Types.ObjectId(labelId),
    });
  }

  async findByConversationId(conversationId: string): Promise<ConversationLabel[]> {
    const docs = await this.model
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 });
    return docs.map(ConversationLabelMapper.toDomain);
  }

  async findByConversationIds(conversationIds: string[]): Promise<ConversationLabel[]> {
    const docs = await this.model.find({
      conversationId: { $in: conversationIds.map((id) => new Types.ObjectId(id)) },
    });
    return docs.map(ConversationLabelMapper.toDomain);
  }

  async findByLabelId(labelId: string): Promise<ConversationLabel[]> {
    const docs = await this.model.find({ labelId: new Types.ObjectId(labelId) });
    return docs.map(ConversationLabelMapper.toDomain);
  }

  async deleteByLabelId(labelId: string): Promise<void> {
    await this.model.deleteMany({ labelId: new Types.ObjectId(labelId) });
  }
}
