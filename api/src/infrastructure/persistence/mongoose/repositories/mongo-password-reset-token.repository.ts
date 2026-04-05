import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PasswordResetTokenRepository } from '../../../../domain/repositories/password-reset-token.repository.js';
import { PasswordResetToken } from '../../../../domain/entities/password-reset-token.entity.js';
import { PasswordResetTokenModel, PasswordResetTokenDocument } from '../schemas/password-reset-token.schema.js';
import { PasswordResetTokenMapper } from '../mappers/password-reset-token.mapper.js';

@Injectable()
export class MongoPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(
    @InjectModel(PasswordResetTokenModel.name) private readonly model: Model<PasswordResetTokenDocument>,
  ) {}

  async create(data: Omit<PasswordResetToken, 'id' | 'createdAt'>): Promise<PasswordResetToken> {
    const doc = await this.model.create({
      agentId: new Types.ObjectId(data.agentId),
      tokenHash: data.tokenHash,
      type: data.type,
      expiresAt: data.expiresAt,
    });
    return PasswordResetTokenMapper.toDomain(doc);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const doc = await this.model.findOne({ tokenHash });
    return doc ? PasswordResetTokenMapper.toDomain(doc) : null;
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.model.deleteMany({ agentId: new Types.ObjectId(agentId) });
  }
}
