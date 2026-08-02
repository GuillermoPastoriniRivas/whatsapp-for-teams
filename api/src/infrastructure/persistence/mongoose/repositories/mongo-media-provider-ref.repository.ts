import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MediaProviderRefRepository,
  UpsertMediaProviderRefInput,
} from '../../../../domain/repositories/media-provider-ref.repository.js';
import { MediaProviderRef } from '../../../../domain/entities/media-provider-ref.entity.js';
import {
  MediaProviderRefModel,
  MediaProviderRefDocument,
} from '../schemas/media-provider-ref.schema.js';
import { MediaProviderRefMapper } from '../mappers/media-provider-ref.mapper.js';

@Injectable()
export class MongoMediaProviderRefRepository implements MediaProviderRefRepository {
  constructor(
    @InjectModel(MediaProviderRefModel.name)
    private readonly model: Model<MediaProviderRefDocument>,
  ) {}

  async findValid(assetId: string, phoneNumberId: string, now: Date): Promise<MediaProviderRef | null> {
    if (!Types.ObjectId.isValid(assetId) || !Types.ObjectId.isValid(phoneNumberId)) return null;
    const doc = await this.model.findOne({
      assetId: new Types.ObjectId(assetId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
      expiresAt: { $gt: now },
    });
    return doc ? MediaProviderRefMapper.toDomain(doc) : null;
  }

  async upsert(input: UpsertMediaProviderRefInput): Promise<MediaProviderRef> {
    const doc = await this.model.findOneAndUpdate(
      {
        assetId: new Types.ObjectId(input.assetId),
        phoneNumberId: new Types.ObjectId(input.phoneNumberId),
      },
      {
        $set: {
          providerMediaId: input.providerMediaId,
          expiresAt: input.expiresAt,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return MediaProviderRefMapper.toDomain(doc!);
  }

  async deleteByAssetId(assetId: string): Promise<void> {
    if (!Types.ObjectId.isValid(assetId)) return;
    await this.model.deleteMany({ assetId: new Types.ObjectId(assetId) });
  }
}
