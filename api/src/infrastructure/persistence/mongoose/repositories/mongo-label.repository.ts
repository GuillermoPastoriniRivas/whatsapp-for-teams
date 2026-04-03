import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LabelRepository } from '../../../../domain/repositories/label.repository.js';
import { Label } from '../../../../domain/entities/label.entity.js';
import { LabelModel, LabelDocument } from '../schemas/label.schema.js';
import { LabelMapper } from '../mappers/label.mapper.js';

@Injectable()
export class MongoLabelRepository implements LabelRepository {
  constructor(
    @InjectModel(LabelModel.name) private readonly model: Model<LabelDocument>,
  ) {}

  async create(data: Omit<Label, 'id' | 'createdAt'>): Promise<Label> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(data.tenantId),
      name: data.name,
      color: data.color,
    });
    return LabelMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Label | null> {
    const doc = await this.model.findById(id);
    return doc ? LabelMapper.toDomain(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Label[]> {
    const docs = await this.model.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } });
    return docs.map(LabelMapper.toDomain);
  }

  async findByTenantId(tenantId: string): Promise<Label[]> {
    const docs = await this.model
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ name: 1 });
    return docs.map(LabelMapper.toDomain);
  }

  async findByTenantIdAndName(tenantId: string, name: string): Promise<Label | null> {
    const doc = await this.model.findOne({
      tenantId: new Types.ObjectId(tenantId),
      name,
    });
    return doc ? LabelMapper.toDomain(doc) : null;
  }

  async update(id: string, data: Partial<Pick<Label, 'name' | 'color'>>): Promise<Label | null> {
    const doc = await this.model.findByIdAndUpdate(id, { $set: data }, { new: true });
    return doc ? LabelMapper.toDomain(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
