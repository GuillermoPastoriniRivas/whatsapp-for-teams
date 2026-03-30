import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PhoneNumberRepository } from '../../../../domain/repositories/phone-number.repository.js';
import { PhoneNumber } from '../../../../domain/entities/phone-number.entity.js';
import { PhoneNumberModel, PhoneNumberDocument } from '../schemas/phone-number.schema.js';
import { PhoneNumberMapper } from '../mappers/phone-number.mapper.js';

@Injectable()
export class MongoPhoneNumberRepository implements PhoneNumberRepository {
  constructor(
    @InjectModel(PhoneNumberModel.name) private readonly model: Model<PhoneNumberDocument>,
  ) {}

  async create(data: Omit<PhoneNumber, 'id' | 'createdAt'>): Promise<PhoneNumber> {
    const doc = await this.model.create({
      ...data,
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

  async findByTenantId(tenantId: string): Promise<PhoneNumber[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) });
    return docs.map(PhoneNumberMapper.toDomain);
  }

  async update(id: string, data: Partial<Pick<PhoneNumber, 'label' | 'status' | 'webhookSecret' | 'providerConfig' | 'wabaId' | 'phoneNumberId' | 'displayPhone'>>): Promise<PhoneNumber | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' });
    return doc ? PhoneNumberMapper.toDomain(doc) : null;
  }
}
