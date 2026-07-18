import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiAgentConfigRepository } from '../../../../domain/repositories/ai-agent-config.repository.js';
import { AiAgentConfig } from '../../../../domain/entities/ai-agent-config.entity.js';
import { AiAgentConfigModel, AiAgentConfigDocument } from '../schemas/ai-agent-config.schema.js';
import { AiAgentConfigMapper } from '../mappers/ai-agent-config.mapper.js';

@Injectable()
export class MongoAiAgentConfigRepository implements AiAgentConfigRepository {
  constructor(
    @InjectModel(AiAgentConfigModel.name) private readonly model: Model<AiAgentConfigDocument>,
  ) {}

  async create(data: Omit<AiAgentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiAgentConfig> {
    const doc = await this.model.create({
      ...data,
      agentId: new Types.ObjectId(data.agentId),
      tenantId: new Types.ObjectId(data.tenantId),
    });
    return AiAgentConfigMapper.toDomain(doc);
  }

  async findByAgentId(agentId: string): Promise<AiAgentConfig | null> {
    const doc = await this.model.findOne({ agentId: new Types.ObjectId(agentId) });
    return doc ? AiAgentConfigMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<AiAgentConfig[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) });
    return docs.map((doc) => AiAgentConfigMapper.toDomain(doc));
  }

  async update(agentId: string, data: Partial<AiAgentConfig>): Promise<AiAgentConfig | null> {
    const updateData = { ...data } as any;
    delete updateData.id;
    delete updateData.agentId;
    delete updateData.tenantId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const doc = await this.model.findOneAndUpdate(
      { agentId: new Types.ObjectId(agentId) },
      { $set: updateData },
      { returnDocument: 'after' },
    );
    return doc ? AiAgentConfigMapper.toDomain(doc) : null;
  }

  async delete(agentId: string): Promise<void> {
    await this.model.deleteOne({ agentId: new Types.ObjectId(agentId) });
  }
}
