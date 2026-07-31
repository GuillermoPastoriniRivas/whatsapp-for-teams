import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFlowVersionInput, FlowVersionRepository } from '../../../../domain/repositories/flow-version.repository.js';
import { FlowVersion } from '../../../../domain/entities/flow-version.entity.js';
import { FlowVersionModel, FlowVersionDocument } from '../schemas/flow-version.schema.js';
import { FlowVersionMapper } from '../mappers/flow-version.mapper.js';

@Injectable()
export class MongoFlowVersionRepository implements FlowVersionRepository {
  constructor(
    @InjectModel(FlowVersionModel.name) private readonly model: Model<FlowVersionDocument>,
  ) {}

  async create(input: CreateFlowVersionInput): Promise<FlowVersion> {
    const doc = await this.model.create({
      ...input,
      flowId: new Types.ObjectId(input.flowId),
      tenantId: new Types.ObjectId(input.tenantId),
      publishedByAgentId: new Types.ObjectId(input.publishedByAgentId),
    });
    return FlowVersionMapper.toDomain(doc);
  }

  async findById(id: string): Promise<FlowVersion | null> {
    const doc = await this.model.findById(new Types.ObjectId(id));
    return doc ? FlowVersionMapper.toDomain(doc) : null;
  }

  async findByIds(ids: string[]): Promise<FlowVersion[]> {
    if (ids.length === 0) return [];
    const docs = await this.model.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } });
    return docs.map(FlowVersionMapper.toDomain);
  }

  async findByFlowId(flowId: string): Promise<FlowVersion[]> {
    const docs = await this.model.find({ flowId: new Types.ObjectId(flowId) }).sort({ version: -1 });
    return docs.map(FlowVersionMapper.toDomain);
  }

  async findLatestByFlowId(flowId: string): Promise<FlowVersion | null> {
    const doc = await this.model.findOne({ flowId: new Types.ObjectId(flowId) }).sort({ version: -1 });
    return doc ? FlowVersionMapper.toDomain(doc) : null;
  }
}
