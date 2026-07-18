import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushSubscriptionRepository } from '../../../../domain/repositories/push-subscription.repository.js';
import { PushSubscription } from '../../../../domain/entities/push-subscription.entity.js';
import { PushSubscriptionModel, PushSubscriptionDocument } from '../schemas/push-subscription.schema.js';
import { PushSubscriptionMapper } from '../mappers/push-subscription.mapper.js';

@Injectable()
export class MongoPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(
    @InjectModel(PushSubscriptionModel.name) private readonly model: Model<PushSubscriptionDocument>,
  ) {}

  async upsertByEndpoint(data: Omit<PushSubscription, 'id' | 'createdAt'>): Promise<PushSubscription> {
    const doc = await this.model.findOneAndUpdate(
      { endpoint: data.endpoint },
      {
        $set: {
          tenantId: new Types.ObjectId(data.tenantId),
          agentId: new Types.ObjectId(data.agentId),
          keys: data.keys,
          userAgent: data.userAgent ?? null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return PushSubscriptionMapper.toDomain(doc);
  }

  async findByAgentId(agentId: string): Promise<PushSubscription[]> {
    const docs = await this.model.find({ agentId: new Types.ObjectId(agentId) });
    return docs.map((doc) => PushSubscriptionMapper.toDomain(doc));
  }

  async deleteByEndpoint(endpoint: string, agentId?: string): Promise<void> {
    await this.model.deleteMany({
      endpoint,
      ...(agentId ? { agentId: new Types.ObjectId(agentId) } : {}),
    });
  }
}
