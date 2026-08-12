import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { CreateRateCardInput, RateCardRepository } from '../../../../domain/repositories/rate-card.repository.js';
import type { RateCard } from '../../../../domain/entities/rate-card.entity.js';
import { RateCardModel, RateCardDocument } from '../schemas/rate-card.schema.js';

const toDomain = (doc: RateCardDocument): RateCard => ({
  id: doc._id.toHexString(),
  name: doc.name,
  effectiveFrom: doc.effectiveFrom,
  effectiveTo: doc.effectiveTo ?? null,
  currency: doc.currency,
  entries: doc.entries ?? [],
  source: doc.source,
  createdAt: doc.createdAt,
});

@Injectable()
export class MongoRateCardRepository implements RateCardRepository {
  constructor(@InjectModel(RateCardModel.name) private readonly model: Model<RateCardDocument>) {}

  async findEffectiveAt(at: Date): Promise<RateCard | null> {
    // La más reciente que ya había arrancado y todavía no había cerrado.
    const doc = await this.model
      .findOne({
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
      })
      .sort({ effectiveFrom: -1 });
    return doc ? toDomain(doc) : null;
  }

  async findById(id: string): Promise<RateCard | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async list(): Promise<RateCard[]> {
    const docs = await this.model.find().sort({ effectiveFrom: -1 });
    return docs.map(toDomain);
  }

  async create(input: CreateRateCardInput): Promise<RateCard> {
    // Cerrar la anterior es parte de crear la nueva: dos cards abiertas a la vez
    // hacen que `findEffectiveAt` dependa del orden de inserción.
    await this.model.updateMany(
      { effectiveTo: null, effectiveFrom: { $lt: input.effectiveFrom } },
      { $set: { effectiveTo: input.effectiveFrom } },
    );
    const doc = await this.model.create({ ...input, createdAt: new Date() });
    return toDomain(doc);
  }
}
