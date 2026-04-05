import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SubscriptionRepository } from '../../../../domain/repositories/subscription.repository.js';
import { Subscription } from '../../../../domain/entities/subscription.entity.js';
import { SubscriptionModel, SubscriptionDocument } from '../schemas/subscription.schema.js';
import { SubscriptionMapper } from '../mappers/subscription.mapper.js';

@Injectable()
export class MongoSubscriptionRepository implements SubscriptionRepository {
  constructor(
    @InjectModel(SubscriptionModel.name) private readonly model: Model<SubscriptionDocument>,
  ) {}

  async create(data: Omit<Subscription, 'id' | 'createdAt' | 'canceledAt'>): Promise<Subscription> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      plan: data.plan,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      paymentProvider: data.paymentProvider ?? 'none',
      externalCustomerId: data.externalCustomerId ?? null,
      externalSubscriptionId: data.externalSubscriptionId ?? null,
    });
    return SubscriptionMapper.toDomain(doc);
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    const doc = await this.model.findOne({ tenantId: new Types.ObjectId(tenantId) });
    return doc ? SubscriptionMapper.toDomain(doc) : null;
  }

  async findByExternalSubscriptionId(externalSubscriptionId: string): Promise<Subscription | null> {
    const doc = await this.model.findOne({ externalSubscriptionId });
    return doc ? SubscriptionMapper.toDomain(doc) : null;
  }

  async update(id: string, data: Partial<Pick<Subscription, 'plan' | 'status' | 'currentPeriodStart' | 'currentPeriodEnd' | 'canceledAt' | 'scheduledPlan' | 'paymentProvider' | 'externalCustomerId' | 'externalSubscriptionId'>>): Promise<Subscription | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' });
    return doc ? SubscriptionMapper.toDomain(doc) : null;
  }
}
