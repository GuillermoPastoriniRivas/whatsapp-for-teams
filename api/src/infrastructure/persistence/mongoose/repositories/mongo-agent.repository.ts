import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentRepository } from '../../../../domain/repositories/agent.repository.js';
import { Agent } from '../../../../domain/entities/agent.entity.js';
import { AgentStatus } from '../../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../../domain/enums/agent-type.enum.js';
import { AgentModel, AgentDocument } from '../schemas/agent.schema.js';
import { AgentMapper } from '../mappers/agent.mapper.js';

@Injectable()
export class MongoAgentRepository implements AgentRepository {
  constructor(
    @InjectModel(AgentModel.name) private readonly model: Model<AgentDocument>,
  ) {}

  async create(data: Omit<Agent, 'id' | 'createdAt'>): Promise<Agent> {
    const doc = await this.model.create({
      ...data,
      tenantId: new Types.ObjectId(data.tenantId),
    });
    return AgentMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Agent | null> {
    const doc = await this.model.findById(id);
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<Agent | null> {
    const doc = await this.model.findOne({ email });
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string, status?: AgentStatus): Promise<Agent[]> {
    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };
    if (status) filter.status = status;
    const docs = await this.model.find(filter);
    return docs.map(AgentMapper.toDomain);
  }

  async updateStatus(id: string, status: AgentStatus): Promise<Agent | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' });
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async incrementActiveCount(id: string, delta: number): Promise<Agent | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $inc: { activeCount: delta } }, { returnDocument: 'after' });
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async findAvailableByIdsAndIncrementLoad(agentIds: string[], excludeType?: AgentType): Promise<Agent | null> {
    const objectIds = agentIds.map((id) => new Types.ObjectId(id));
    const filter: Record<string, unknown> = {
      _id: { $in: objectIds },
      status: AgentStatus.AVAILABLE,
    };
    if (excludeType) {
      filter.type = { $ne: excludeType };
    }
    const doc = await this.model.findOneAndUpdate(
      filter,
      { $inc: { activeCount: 1 } },
      {
        sort: { activeCount: 1 },
        returnDocument: 'after',
      },
    );
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async updateName(id: string, name: string): Promise<Agent | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: { name } }, { returnDocument: 'after' });
    return doc ? AgentMapper.toDomain(doc) : null;
  }
}
