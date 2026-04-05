import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentRepository } from '../../../../domain/repositories/agent.repository.js';
import { Agent } from '../../../../domain/entities/agent.entity.js';
import { AgentRole } from '../../../../domain/enums/agent-role.enum.js';
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
      frozen: { $ne: true },
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

  async updateProfile(id: string, data: { name?: string; role?: AgentRole }): Promise<Agent | null> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.role !== undefined) update.role = data.role;
    const doc = await this.model.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' });
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id);
    return result !== null;
  }

  async countByTenantIdAndType(tenantId: string, type: AgentType): Promise<number> {
    return this.model.countDocuments({ tenantId: new Types.ObjectId(tenantId), type });
  }

  async updateFrozen(id: string, frozen: boolean): Promise<Agent | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: { frozen } }, { returnDocument: 'after' });
    return doc ? AgentMapper.toDomain(doc) : null;
  }

  async findByTenantIdAndType(tenantId: string, type: AgentType): Promise<Agent[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId), type }).sort({ createdAt: 1 });
    return docs.map(AgentMapper.toDomain);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<Agent | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: { passwordHash } }, { returnDocument: 'after' });
    return doc ? AgentMapper.toDomain(doc) : null;
  }
}
