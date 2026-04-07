import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderRepository, OrderFilters, PaginatedOrders } from '../../../../domain/repositories/order.repository.js';
import { Order } from '../../../../domain/entities/order.entity.js';
import { OrderStatus } from '../../../../domain/enums/order-status.enum.js';
import { OrderModel, OrderDocument } from '../schemas/order.schema.js';
import { OrderMapper } from '../mappers/order.mapper.js';

@Injectable()
export class MongoOrderRepository implements OrderRepository {
  constructor(
    @InjectModel(OrderModel.name) private readonly model: Model<OrderDocument>,
  ) {}

  async create(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      conversationId: new Types.ObjectId(data.conversationId),
      contactId: new Types.ObjectId(data.contactId),
      phoneNumberId: new Types.ObjectId(data.phoneNumberId),
      createdByAgentId: data.createdByAgentId,
      status: data.status,
      items: data.items,
      deliveryType: data.deliveryType,
      deliveryAddress: data.deliveryAddress,
      deliveryNotes: data.deliveryNotes,
      estimatedTotal: data.estimatedTotal,
      currency: data.currency,
    });
    return OrderMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Order | null> {
    const doc = await this.model.findById(id);
    return doc ? OrderMapper.toDomain(doc) : null;
  }

  async findByConversationId(conversationId: string): Promise<Order[]> {
    const docs = await this.model
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 });
    return docs.map(OrderMapper.toDomain);
  }

  async findByFilters(filters: OrderFilters): Promise<PaginatedOrders> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(filters.tenantId),
    };
    if (filters.status) query.status = filters.status;
    if (filters.phoneNumberId) query.phoneNumberId = new Types.ObjectId(filters.phoneNumberId);

    const total = await this.model.countDocuments(query);
    const pages = Math.ceil(total / filters.limit) || 1;
    const docs = await this.model
      .find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit);

    return {
      data: docs.map(OrderMapper.toDomain),
      meta: { total, page: filters.page, pages },
    };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const doc = await this.model.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: 'after' },
    );
    return doc ? OrderMapper.toDomain(doc) : null;
  }
}
