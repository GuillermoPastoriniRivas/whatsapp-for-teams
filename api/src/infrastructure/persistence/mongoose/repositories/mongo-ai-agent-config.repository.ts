import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiAgentConfigRepository } from '../../../../domain/repositories/ai-agent-config.repository.js';
import { AiAgentConfig } from '../../../../domain/entities/ai-agent-config.entity.js';
import { AiAgentConfigModel, AiAgentConfigDocument } from '../schemas/ai-agent-config.schema.js';
import { AiAgentConfigMapper } from '../mappers/ai-agent-config.mapper.js';
import { EncryptionService } from '../../../ai/encryption.service.js';

@Injectable()
export class MongoAiAgentConfigRepository implements AiAgentConfigRepository {
  constructor(
    @InjectModel(AiAgentConfigModel.name) private readonly model: Model<AiAgentConfigDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async create(data: Omit<AiAgentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiAgentConfig> {
    const doc = await this.model.create({
      ...data,
      agentId: new Types.ObjectId(data.agentId),
      tenantId: new Types.ObjectId(data.tenantId),
      apiKey: this.encryption.encrypt(data.apiKey),
    });
    const config = AiAgentConfigMapper.toDomain(doc);
    return new AiAgentConfig(
      config.id, config.agentId, config.tenantId, config.provider, config.model,
      data.apiKey, // Return unencrypted
      config.systemPrompt, config.knowledgeBase, config.persona,
      config.handoffRules, config.contextConfig, config.rateLimits, config.goals,
      config.isActive, config.multiMessage, config.createdAt, config.updatedAt,
    );
  }

  async findByAgentId(agentId: string): Promise<AiAgentConfig | null> {
    const doc = await this.model.findOne({ agentId: new Types.ObjectId(agentId) });
    if (!doc) return null;
    const config = AiAgentConfigMapper.toDomain(doc);
    return new AiAgentConfig(
      config.id, config.agentId, config.tenantId, config.provider, config.model,
      this.encryption.decrypt(config.apiKey),
      config.systemPrompt, config.knowledgeBase, config.persona,
      config.handoffRules, config.contextConfig, config.rateLimits, config.goals,
      config.isActive, config.multiMessage, config.createdAt, config.updatedAt,
    );
  }

  async findByTenantId(tenantId: string): Promise<AiAgentConfig[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) });
    return docs.map((doc) => {
      const config = AiAgentConfigMapper.toDomain(doc);
      return new AiAgentConfig(
        config.id, config.agentId, config.tenantId, config.provider, config.model,
        this.encryption.decrypt(config.apiKey),
        config.systemPrompt, config.knowledgeBase, config.persona,
        config.handoffRules, config.contextConfig, config.rateLimits, config.goals,
        config.isActive, config.multiMessage, config.createdAt, config.updatedAt,
      );
    });
  }

  async update(agentId: string, data: Partial<AiAgentConfig>): Promise<AiAgentConfig | null> {
    const updateData = { ...data } as any;
    delete updateData.id;
    delete updateData.agentId;
    delete updateData.tenantId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (updateData.apiKey) {
      updateData.apiKey = this.encryption.encrypt(updateData.apiKey);
    }

    const doc = await this.model.findOneAndUpdate(
      { agentId: new Types.ObjectId(agentId) },
      { $set: updateData },
      { returnDocument: 'after' },
    );
    if (!doc) return null;

    const config = AiAgentConfigMapper.toDomain(doc);
    return new AiAgentConfig(
      config.id, config.agentId, config.tenantId, config.provider, config.model,
      this.encryption.decrypt(config.apiKey),
      config.systemPrompt, config.knowledgeBase, config.persona,
      config.handoffRules, config.contextConfig, config.rateLimits, config.goals,
      config.isActive, config.multiMessage, config.createdAt, config.updatedAt,
    );
  }

  async delete(agentId: string): Promise<void> {
    await this.model.deleteOne({ agentId: new Types.ObjectId(agentId) });
  }
}
