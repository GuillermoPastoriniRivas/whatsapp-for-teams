import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillingRecordRepository } from '../../../../domain/repositories/billing-record.repository.js';
import { BillingRecord } from '../../../../domain/entities/billing-record.entity.js';
import { BillingRecordModel, BillingRecordDocument } from '../schemas/billing-record.schema.js';
import { BillingRecordMapper } from '../mappers/billing-record.mapper.js';

@Injectable()
export class MongoBillingRecordRepository implements BillingRecordRepository {
  constructor(
    @InjectModel(BillingRecordModel.name) private readonly model: Model<BillingRecordDocument>,
  ) {}

  async create(data: Omit<BillingRecord, 'id' | 'createdAt'>): Promise<BillingRecord> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      eventType: data.eventType,
      plan: data.plan,
      amountCents: data.amountCents,
      description: data.description,
    });
    return BillingRecordMapper.toDomain(doc);
  }

  async findByTenantId(tenantId: string): Promise<BillingRecord[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ createdAt: -1 });
    return docs.map(BillingRecordMapper.toDomain);
  }
}
