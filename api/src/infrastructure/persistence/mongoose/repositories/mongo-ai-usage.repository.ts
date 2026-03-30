import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiUsageRepository } from '../../../../domain/repositories/ai-usage.repository.js';
import { AiUsage } from '../../../../domain/entities/ai-usage.entity.js';
import { AiUsageModel, AiUsageDocument } from '../schemas/ai-usage.schema.js';
import { AiUsageMapper } from '../mappers/ai-usage.mapper.js';

@Injectable()
export class MongoAiUsageRepository implements AiUsageRepository {
  constructor(
    @InjectModel(AiUsageModel.name) private readonly model: Model<AiUsageDocument>,
  ) {}

  async incrementUsage(
    tenantId: string,
    aiAgentId: string,
    date: string,
    messageDelta: number,
    tokenDelta: number,
  ): Promise<AiUsage> {
    const doc = await this.model.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        aiAgentId: new Types.ObjectId(aiAgentId),
        date,
      },
      {
        $inc: { messageCount: messageDelta, tokenCount: tokenDelta },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );
    return AiUsageMapper.toDomain(doc!);
  }

  async getUsage(tenantId: string, aiAgentId: string, date: string): Promise<AiUsage | null> {
    const doc = await this.model.findOne({
      tenantId: new Types.ObjectId(tenantId),
      aiAgentId: new Types.ObjectId(aiAgentId),
      date,
    });
    return doc ? AiUsageMapper.toDomain(doc) : null;
  }
}
