import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WebhookDeliveryRepository } from '../../../../domain/repositories/webhook-delivery.repository.js';
import { WebhookDelivery } from '../../../../domain/entities/webhook-delivery.entity.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { WebhookDeliveryModel, WebhookDeliveryDocument } from '../schemas/webhook-delivery.schema.js';
import { WebhookDeliveryMapper } from '../mappers/webhook-delivery.mapper.js';

@Injectable()
export class MongoWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(
    @InjectModel(WebhookDeliveryModel.name) private readonly model: Model<WebhookDeliveryDocument>,
  ) {}

  async create(
    data: Omit<
      WebhookDelivery,
      'id' | 'status' | 'attempts' | 'responseStatus' | 'responseBody' | 'lastError' | 'lastAttemptAt' | 'nextRetryAt' | 'createdAt'
    >,
  ): Promise<WebhookDelivery> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      endpointId: new Types.ObjectId(data.endpointId),
      eventId: data.eventId,
      eventType: data.eventType,
      payload: data.payload,
    });
    return WebhookDeliveryMapper.toDomain(doc);
  }

  async findById(id: string): Promise<WebhookDelivery | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id);
    return doc ? WebhookDeliveryMapper.toDomain(doc) : null;
  }

  async findByEndpointId(endpointId: string, page: number, limit: number): Promise<PaginatedResult<WebhookDelivery>> {
    const query = { endpointId: new Types.ObjectId(endpointId) };
    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.model.countDocuments(query),
    ]);
    return {
      data: docs.map(WebhookDeliveryMapper.toDomain),
      meta: { total, page, pages: Math.ceil(total / limit) },
    };
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        WebhookDelivery,
        'status' | 'attempts' | 'responseStatus' | 'responseBody' | 'lastError' | 'lastAttemptAt' | 'nextRetryAt'
      >
    >,
  ): Promise<WebhookDelivery | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: data }, { new: true });
    return doc ? WebhookDeliveryMapper.toDomain(doc) : null;
  }

  async deleteByEndpointId(endpointId: string): Promise<void> {
    await this.model.deleteMany({ endpointId: new Types.ObjectId(endpointId) });
  }
}
