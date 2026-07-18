import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BulkUpsertContactRow, ContactRepository } from '../../../../domain/repositories/contact.repository.js';
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

  async bulkUpsertByWaId(tenantId: string, rows: BulkUpsertContactRow[]): Promise<{ inserted: number; updated: number }> {
    if (rows.length === 0) return { inserted: 0, updated: 0 };

    const tenantObjectId = new Types.ObjectId(tenantId);
    const result = await this.model.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { tenantId: tenantObjectId, waId: row.waId },
          update: {
            $set: {
              name: row.name,
              phone: row.phone,
              ...(row.email !== undefined && { email: row.email }),
              ...(row.company !== undefined && { company: row.company }),
              ...(row.customFields && Object.keys(row.customFields).length > 0
                ? Object.fromEntries(Object.entries(row.customFields).map(([k, v]) => [`customFields.${k}`, v]))
                : {}),
            },
            $setOnInsert: { tenantId: tenantObjectId, waId: row.waId, lastSeenAt: new Date() },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    return { inserted: result.upsertedCount ?? 0, updated: result.modifiedCount ?? 0 };
  }

  async findByIds(ids: string[]): Promise<Contact[]> {
    if (ids.length === 0) return [];
    const docs = await this.model.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } });
    return docs.map(ContactMapper.toDomain);
  }
}
