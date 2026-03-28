import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MessageRepository } from '../../../../domain/repositories/message.repository.js';
import { Message } from '../../../../domain/entities/message.entity.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { MessageModel, MessageDocument } from '../schemas/message.schema.js';
import { MessageMapper } from '../mappers/message.mapper.js';

@Injectable()
export class MongoMessageRepository implements MessageRepository {
  constructor(
    @InjectModel(MessageModel.name) private readonly model: Model<MessageDocument>,
  ) {}

  async upsertByWaMessageId(message: Omit<Message, 'id'>): Promise<Message> {
    const doc = await this.model.findOneAndUpdate(
      { waMessageId: message.waMessageId },
      {
        $setOnInsert: {
          conversationId: new Types.ObjectId(message.conversationId),
          direction: message.direction,
          messageType: message.messageType,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mimeType: message.mimeType,
          waStatus: message.waStatus,
          timestamp: message.timestamp,
          senderAgentId: message.senderAgentId,
          senderAgentName: message.senderAgentName,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return MessageMapper.toDomain(doc!);
  }

  async findByConversationId(conversationId: string, page: number, limit: number): Promise<PaginatedResult<Message>> {
    const filter = { conversationId: new Types.ObjectId(conversationId) };

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ timestamp: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.model.countDocuments(filter),
    ]);

    return {
      data: docs.map(MessageMapper.toDomain),
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatusByWaMessageId(waMessageId: string, waStatus: MessageWaStatus): Promise<Message | null> {
    const doc = await this.model.findOneAndUpdate(
      { waMessageId },
      { $set: { waStatus } },
      { returnDocument: 'after' },
    );
    return doc ? MessageMapper.toDomain(doc) : null;
  }
}
