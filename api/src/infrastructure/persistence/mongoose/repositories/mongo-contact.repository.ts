import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContactRepository } from '../../../../domain/repositories/contact.repository.js';
import { Contact } from '../../../../domain/entities/contact.entity.js';
import { ContactModel, ContactDocument } from '../schemas/contact.schema.js';
import { ContactMapper } from '../mappers/contact.mapper.js';

@Injectable()
export class MongoContactRepository implements ContactRepository {
  constructor(
    @InjectModel(ContactModel.name) private readonly model: Model<ContactDocument>,
  ) {}

  async upsertByWaId(
    tenantId: string,
    waId: string,
    data: { name: string; phone: string; profilePicUrl?: string | null },
  ): Promise<Contact> {
    const doc = await this.model.findOneAndUpdate(
      { tenantId: new Types.ObjectId(tenantId), waId },
      {
        $set: {
          name: data.name,
          phone: data.phone,
          ...(data.profilePicUrl !== undefined && { profilePicUrl: data.profilePicUrl }),
          lastSeenAt: new Date(),
        },
        $setOnInsert: {
          tenantId: new Types.ObjectId(tenantId),
          waId,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return ContactMapper.toDomain(doc!);
  }

  async findById(id: string): Promise<Contact | null> {
    const doc = await this.model.findById(id);
    return doc ? ContactMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string, options: { search?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };
    if (options.search) {
      const regex = { $regex: options.search, $options: 'i' };
      filter.$or = [{ name: regex }, { phone: regex }, { waId: regex }, { email: regex }, { company: regex }];
    }

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ lastSeenAt: -1 })
        .skip((options.page - 1) * options.limit)
        .limit(options.limit),
      this.model.countDocuments(filter),
    ]);

    return {
      data: data.map(ContactMapper.toDomain),
      meta: { total, page: options.page, pages: Math.ceil(total / options.limit) },
    };
  }

  async update(
    id: string,
    data: { name?: string; email?: string | null; company?: string | null; notes?: string | null; customFields?: Record<string, string> },
  ): Promise<Contact | null> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.email !== undefined) update.email = data.email;
    if (data.company !== undefined) update.company = data.company;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.customFields !== undefined) update.customFields = data.customFields;

    const doc = await this.model.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' });
    return doc ? ContactMapper.toDomain(doc) : null;
  }
}
