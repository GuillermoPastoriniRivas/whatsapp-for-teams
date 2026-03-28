import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationNoteRepository } from '../../../../domain/repositories/conversation-note.repository.js';
import { ConversationNote } from '../../../../domain/entities/conversation-note.entity.js';
import { ConversationNoteModel, ConversationNoteDocument } from '../schemas/conversation-note.schema.js';
import { ConversationNoteMapper } from '../mappers/conversation-note.mapper.js';

@Injectable()
export class MongoConversationNoteRepository implements ConversationNoteRepository {
  constructor(
    @InjectModel(ConversationNoteModel.name) private readonly model: Model<ConversationNoteDocument>,
  ) {}

  async create(data: Omit<ConversationNote, 'id' | 'createdAt'>): Promise<ConversationNote> {
    const doc = await this.model.create({
      conversationId: new Types.ObjectId(data.conversationId),
      tenantId: new Types.ObjectId(data.tenantId),
      authorId: data.authorId,
      authorName: data.authorName,
      body: data.body,
    });
    return ConversationNoteMapper.toDomain(doc);
  }

  async findByConversationId(conversationId: string): Promise<ConversationNote[]> {
    const docs = await this.model
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 });
    return docs.map(ConversationNoteMapper.toDomain);
  }
}
