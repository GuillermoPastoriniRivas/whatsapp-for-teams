import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PhoneNumberRepository } from '../../../../domain/repositories/phone-number.repository.js';
import { PhoneNumber } from '../../../../domain/entities/phone-number.entity.js';
import { PhoneNumberModel, PhoneNumberDocument } from '../schemas/phone-number.schema.js';
import { PhoneNumberMapper } from '../mappers/phone-number.mapper.js';
import { encryptProviderConfig } from '../../../crypto/provider-config.cipher.js';

@Injectable()
export class MongoPhoneNumberRepository implements PhoneNumberRepository {
  constructor(
    @InjectModel(PhoneNumberModel.name) private readonly model: Model<PhoneNumberDocument>,
  ) {}

  async create(data: Omit<PhoneNumber, 'id' | 'createdAt'>): Promise<PhoneNumber> {
    const doc = await this.model.create({
      ...data,
      providerConfig: encryptProviderConfig(data.providerConfig),
      tenantId: new Types.ObjectId(data.tenantId),
    });
    return PhoneNumberMapper.toDomain(doc);
  }

  async findById(id: string): Promise<PhoneNumber | null> {
    const doc = await this.model.findById(id);
    return doc ? PhoneNumberMapper.toDomain(doc) : null;
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<PhoneNumber | null> {
    const doc = await this.model.findOne({ phoneNumberId });
    return doc ? PhoneNumberMapper.toDomain(doc) : null;
  }

  async findByWabaId(wabaId: string): Promise<PhoneNumber | null> {
    // Phones in the same WABA share the Meta App Secret (webhookSecret),
    // so any active one works for WABA-level webhook signature validation.
    const doc = await this.model.findOne({ wabaId, status: 'active' });
    return doc ? PhoneNumberMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<PhoneNumber[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) });
    return docs.map(PhoneNumberMapper.toDomain);
  }

  async update(id: string, data: Partial<Pick<PhoneNumber, 'label' | 'status' | 'webhookSecret' | 'providerConfig' | 'wabaId' | 'phoneNumberId' | 'displayPhone' | 'portfolioId' | 'businessProfile'>>): Promise<PhoneNumber | null> {
    const patch = data.providerConfig
      ? { ...data, providerConfig: encryptProviderConfig(data.providerConfig) }
      : data;
    const doc = await this.model.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' });
    return doc ? PhoneNumberMapper.toDomain(doc) : null;
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return this.model.countDocuments({ tenantId: new Types.ObjectId(tenantId) });
  }
}
