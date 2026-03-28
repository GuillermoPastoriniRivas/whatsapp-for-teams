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
}
