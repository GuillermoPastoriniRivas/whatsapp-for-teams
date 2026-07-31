import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiKeyRepository } from '../../../../domain/repositories/api-key.repository.js';
import { ApiKey } from '../../../../domain/entities/api-key.entity.js';
import { ApiKeyModel, ApiKeyDocument } from '../schemas/api-key.schema.js';
import { ApiKeyMapper } from '../mappers/api-key.mapper.js';

@Injectable()
export class MongoApiKeyRepository implements ApiKeyRepository {
  constructor(
    @InjectModel(ApiKeyModel.name) private readonly model: Model<ApiKeyDocument>,
  ) {}

  async create(data: Omit<ApiKey, 'id' | 'lastUsedAt' | 'revokedAt' | 'createdAt'>): Promise<ApiKey> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      name: data.name,
      prefix: data.prefix,
      keyHash: data.keyHash,
      createdBy: data.createdBy ? new Types.ObjectId(data.createdBy) : null,
    });
    return ApiKeyMapper.toDomain(doc);
  }

  async findById(id: string): Promise<ApiKey | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id);
    return doc ? ApiKeyMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<ApiKey[]> {
    const docs = await this.model
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 });
    return docs.map(ApiKeyMapper.toDomain);
  }

  async findActiveByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const doc = await this.model.findOne({ keyHash, revokedAt: null });
    return doc ? ApiKeyMapper.toDomain(doc) : null;
  }

  async updateLastUsed(id: string, when: Date): Promise<void> {
    await this.model.updateOne({ _id: new Types.ObjectId(id) }, { $set: { lastUsedAt: when } });
  }

  async revoke(id: string, when: Date): Promise<ApiKey | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: { revokedAt: when } }, { new: true });
    return doc ? ApiKeyMapper.toDomain(doc) : null;
  }

  async countActiveByTenantId(tenantId: string): Promise<number> {
    return this.model.countDocuments({ tenantId: new Types.ObjectId(tenantId), revokedAt: null });
  }
}
