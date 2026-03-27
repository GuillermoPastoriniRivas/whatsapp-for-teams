import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshTokenRepository } from '../../../../domain/repositories/refresh-token.repository.js';
import { RefreshToken } from '../../../../domain/entities/refresh-token.entity.js';
import { RefreshTokenModel, RefreshTokenDocument } from '../schemas/refresh-token.schema.js';
import { RefreshTokenMapper } from '../mappers/refresh-token.mapper.js';

@Injectable()
export class MongoRefreshTokenRepository implements RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshTokenModel.name) private readonly model: Model<RefreshTokenDocument>,
  ) {}

  async create(data: Omit<RefreshToken, 'id' | 'createdAt'>): Promise<RefreshToken> {
    const doc = await this.model.create({
      agentId: new Types.ObjectId(data.agentId),
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    });
    return RefreshTokenMapper.toDomain(doc);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const doc = await this.model.findOne({ tokenHash });
    return doc ? RefreshTokenMapper.toDomain(doc) : null;
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.model.deleteMany({ agentId: new Types.ObjectId(agentId) });
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.model.deleteOne({ tokenHash });
  }
}
