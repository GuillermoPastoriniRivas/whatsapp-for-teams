import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WebhookEndpointRepository } from '../../../../domain/repositories/webhook-endpoint.repository.js';
import { WebhookEndpoint } from '../../../../domain/entities/webhook-endpoint.entity.js';
import { DeveloperEventType } from '../../../../domain/enums/developer-event-type.enum.js';
import { WebhookEndpointModel, WebhookEndpointDocument } from '../schemas/webhook-endpoint.schema.js';
import { WebhookEndpointMapper } from '../mappers/webhook-endpoint.mapper.js';

@Injectable()
export class MongoWebhookEndpointRepository implements WebhookEndpointRepository {
  constructor(
    @InjectModel(WebhookEndpointModel.name) private readonly model: Model<WebhookEndpointDocument>,
  ) {}

  async create(data: Omit<WebhookEndpoint, 'id' | 'createdAt'>): Promise<WebhookEndpoint> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      url: data.url,
      description: data.description,
      secret: data.secret,
      events: data.events,
      active: data.active,
    });
    return WebhookEndpointMapper.toDomain(doc);
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id);
    return doc ? WebhookEndpointMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<WebhookEndpoint[]> {
    const docs = await this.model
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 });
    return docs.map(WebhookEndpointMapper.toDomain);
  }

  async findActiveByTenantAndEvent(tenantId: string, event: DeveloperEventType): Promise<WebhookEndpoint[]> {
    const docs = await this.model.find({
      tenantId: new Types.ObjectId(tenantId),
      active: true,
      events: event,
    });
    return docs.map(WebhookEndpointMapper.toDomain);
  }

  async update(
    id: string,
    data: Partial<Pick<WebhookEndpoint, 'url' | 'description' | 'events' | 'active' | 'secret'>>,
  ): Promise<WebhookEndpoint | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: data }, { new: true });
    return doc ? WebhookEndpointMapper.toDomain(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return this.model.countDocuments({ tenantId: new Types.ObjectId(tenantId) });
  }
}
