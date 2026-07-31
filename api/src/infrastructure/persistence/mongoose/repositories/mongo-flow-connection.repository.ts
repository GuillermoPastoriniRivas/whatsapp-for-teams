import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFlowConnectionInput, FlowConnectionRepository } from '../../../../domain/repositories/flow-connection.repository.js';
import { FlowConnection } from '../../../../domain/entities/flow-connection.entity.js';
import { FlowConnectionModel, FlowConnectionDocument } from '../schemas/flow-connection.schema.js';
import { FlowConnectionMapper } from '../mappers/flow-connection.mapper.js';

@Injectable()
export class MongoFlowConnectionRepository implements FlowConnectionRepository {
  constructor(
    @InjectModel(FlowConnectionModel.name) private readonly model: Model<FlowConnectionDocument>,
  ) {}

  async create(input: CreateFlowConnectionInput): Promise<FlowConnection> {
    const doc = await this.model.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
    });
    return FlowConnectionMapper.toDomain(doc);
  }

  async findById(id: string): Promise<FlowConnection | null> {
    const doc = await this.model.findById(new Types.ObjectId(id));
    return doc ? FlowConnectionMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<FlowConnection[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ createdAt: -1 });
    return docs.map(FlowConnectionMapper.toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: new Types.ObjectId(id) });
  }
}
