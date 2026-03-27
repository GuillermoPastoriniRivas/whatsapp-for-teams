import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantRepository } from '../../../../domain/repositories/tenant.repository.js';
import { Tenant } from '../../../../domain/entities/tenant.entity.js';
import { TenantModel, TenantDocument } from '../schemas/tenant.schema.js';
import { TenantMapper } from '../mappers/tenant.mapper.js';

@Injectable()
export class MongoTenantRepository implements TenantRepository {
  constructor(
    @InjectModel(TenantModel.name) private readonly model: Model<TenantDocument>,
  ) {}

  async create(data: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant> {
    const doc = await this.model.create(data);
    return TenantMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Tenant | null> {
    const doc = await this.model.findById(id);
    return doc ? TenantMapper.toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const doc = await this.model.findOne({ slug });
    return doc ? TenantMapper.toDomain(doc) : null;
  }
}
