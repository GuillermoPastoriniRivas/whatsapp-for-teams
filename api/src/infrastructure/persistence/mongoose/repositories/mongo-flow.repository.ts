import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFlowInput, FlowRepository, UpdateFlowInput } from '../../../../domain/repositories/flow.repository.js';
import { Flow, FlowStats } from '../../../../domain/entities/flow.entity.js';
import { FlowStatus } from '../../../../domain/enums/flow-status.enum.js';
import { FlowModel, FlowDocument } from '../schemas/flow.schema.js';
import { FlowMapper } from '../mappers/flow.mapper.js';

@Injectable()
export class MongoFlowRepository implements FlowRepository {
  constructor(
    @InjectModel(FlowModel.name) private readonly model: Model<FlowDocument>,
  ) {}

  async create(input: CreateFlowInput): Promise<Flow> {
    const doc = await this.model.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      publishedVersionId: input.publishedVersionId ? new Types.ObjectId(input.publishedVersionId) : null,
      createdByAgentId: new Types.ObjectId(input.createdByAgentId),
      defaultForPhoneNumberId: input.defaultForPhoneNumberId
        ? new Types.ObjectId(input.defaultForPhoneNumberId)
        : null,
    });
    return FlowMapper.toDomain(doc);
  }

  async findDefaultByPhoneNumberId(phoneNumberId: string): Promise<Flow | null> {
    if (!Types.ObjectId.isValid(phoneNumberId)) return null;
    const doc = await this.model.findOne({ defaultForPhoneNumberId: new Types.ObjectId(phoneNumberId) });
    return doc ? FlowMapper.toDomain(doc) : null;
  }

  async findById(id: string): Promise<Flow | null> {
    // El webhook público recibe el id sin validar: un id malformado debe ser
    // "no existe" (404), no una excepción de BSON que sale como 500.
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(new Types.ObjectId(id));
    return doc ? FlowMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<Flow[]> {
    const docs = await this.model
      .find({ tenantId: new Types.ObjectId(tenantId), status: { $ne: FlowStatus.ARCHIVED } })
      .sort({ priority: 1, createdAt: 1 });
    return docs.map(FlowMapper.toDomain);
  }

  async findPublishedByTenantId(tenantId: string): Promise<Flow[]> {
    const docs = await this.model
      .find({ tenantId: new Types.ObjectId(tenantId), status: FlowStatus.PUBLISHED })
      .sort({ priority: 1, createdAt: 1 });
    return docs.map(FlowMapper.toDomain);
  }

  async update(id: string, patch: UpdateFlowInput): Promise<Flow | null> {
    const set: Record<string, unknown> = { ...patch };
    if (patch.publishedVersionId !== undefined) {
      set.publishedVersionId = patch.publishedVersionId ? new Types.ObjectId(patch.publishedVersionId) : null;
    }
    const doc = await this.model.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $set: set },
      { returnDocument: 'after' },
    );
    return doc ? FlowMapper.toDomain(doc) : null;
  }

  async transitionStatus(id: string, from: FlowStatus[], to: FlowStatus, extra?: UpdateFlowInput): Promise<Flow | null> {
    const set: Record<string, unknown> = { ...(extra ?? {}), status: to };
    if (extra?.publishedVersionId !== undefined) {
      set.publishedVersionId = extra.publishedVersionId ? new Types.ObjectId(extra.publishedVersionId) : null;
    }
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: { $in: from } },
      { $set: set },
      { returnDocument: 'after' },
    );
    return doc ? FlowMapper.toDomain(doc) : null;
  }

  async incrementStats(id: string, delta: Partial<FlowStats>): Promise<void> {
    const inc: Record<string, number> = {};
    for (const [key, value] of Object.entries(delta)) {
      if (typeof value === 'number' && value !== 0) inc[`stats.${key}`] = value;
    }
    if (Object.keys(inc).length === 0) return;
    await this.model.updateOne({ _id: new Types.ObjectId(id) }, { $inc: inc });
  }
}
