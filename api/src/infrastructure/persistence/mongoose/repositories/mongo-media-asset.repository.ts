import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateMediaAssetInput,
  MediaAssetQuery,
  MediaAssetRepository,
  MediaUsageSummary,
  UpdateMediaAssetInput,
} from '../../../../domain/repositories/media-asset.repository.js';
import { MediaAsset } from '../../../../domain/entities/media-asset.entity.js';
import { MediaAssetStatus } from '../../../../domain/enums/media-asset-status.enum.js';
import { MediaKind } from '../../../../domain/enums/media-kind.enum.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { MediaAssetModel, MediaAssetDocument } from '../schemas/media-asset.schema.js';
import { MediaAssetMapper } from '../mappers/media-asset.mapper.js';

/** Filtro de Mongo. Mongoose 9 renombró FilterQuery, se evita depender del nombre. */
type MediaAssetFilter = Record<string, any>;

function toObjectId(value: string | null | undefined): Types.ObjectId | null {
  return value ? new Types.ObjectId(value) : null;
}

/** Escapa un término de usuario antes de meterlo en un $regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class MongoMediaAssetRepository implements MediaAssetRepository {
  constructor(
    @InjectModel(MediaAssetModel.name) private readonly model: Model<MediaAssetDocument>,
  ) {}

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const doc = await this.model.create({
      tenantId: new Types.ObjectId(input.tenantId),
      kind: input.kind,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256 ?? null,
      filename: input.filename ?? null,
      storageKey: input.storageKey ?? null,
      storageProvider: input.storageProvider ?? null,
      derivatives: [],
      metaMediaId: input.metaMediaId ?? null,
      metaExpiresAt: input.metaExpiresAt ?? null,
      backfilledAt: null,
      source: input.source,
      phoneNumberId: toObjectId(input.phoneNumberId),
      conversationId: toObjectId(input.conversationId),
      contactId: toObjectId(input.contactId),
      messageId: toObjectId(input.messageId),
      uploadedByAgentId: input.uploadedByAgentId ?? null,
      status: input.status,
      failureReason: null,
      expiresAt: input.expiresAt ?? null,
      deletedAt: null,
      inLibrary: input.inLibrary ?? false,
      title: input.title ?? null,
      tags: input.tags ?? [],
      width: input.width ?? null,
      height: input.height ?? null,
      durationMs: input.durationMs ?? null,
    });
    return MediaAssetMapper.toDomain(doc);
  }

  async findById(id: string): Promise<MediaAsset | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id);
    return doc ? MediaAssetMapper.toDomain(doc) : null;
  }

  async findByIds(ids: string[]): Promise<MediaAsset[]> {
    const valid = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (!valid.length) return [];
    const docs = await this.model.find({ _id: { $in: valid } });
    return docs.map(MediaAssetMapper.toDomain);
  }

  async findByMessageId(messageId: string): Promise<MediaAsset | null> {
    if (!Types.ObjectId.isValid(messageId)) return null;
    const doc = await this.model.findOne({ messageId: new Types.ObjectId(messageId) });
    return doc ? MediaAssetMapper.toDomain(doc) : null;
  }

  async findStoredBySha256(tenantId: string, sha256: string): Promise<MediaAsset | null> {
    const doc = await this.model.findOne({
      tenantId: new Types.ObjectId(tenantId),
      sha256,
      storageKey: { $ne: null },
      status: MediaAssetStatus.READY,
      deletedAt: null,
    });
    return doc ? MediaAssetMapper.toDomain(doc) : null;
  }

  async findReusableBySha256(tenantId: string, sha256: string, now: Date): Promise<MediaAsset | null> {
    const doc = await this.model
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        sha256,
        deletedAt: null,
        $or: [
          { status: MediaAssetStatus.READY, storageKey: { $ne: null } },
          { status: MediaAssetStatus.META_ONLY, metaExpiresAt: { $gt: now } },
        ],
      })
      // Con bytes propios primero: no depende de que Meta siga teniéndolo.
      .sort({ storageKey: -1, createdAt: -1 });
    return doc ? MediaAssetMapper.toDomain(doc) : null;
  }

  async update(id: string, input: UpdateMediaAssetInput): Promise<MediaAsset | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const $set: Record<string, unknown> = { ...input };
    if (input.messageId !== undefined) $set.messageId = toObjectId(input.messageId);
    const doc = await this.model.findByIdAndUpdate(id, { $set }, { returnDocument: 'after' });
    return doc ? MediaAssetMapper.toDomain(doc) : null;
  }

  async search(query: MediaAssetQuery): Promise<PaginatedResult<MediaAsset>> {
    const filter = this.buildFilter(query);

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      this.model.countDocuments(filter),
    ]);

    return {
      data: docs.map(MediaAssetMapper.toDomain),
      meta: {
        total,
        page: query.page,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  private buildFilter(query: MediaAssetQuery): MediaAssetFilter {
    const filter: MediaAssetFilter = {
      tenantId: new Types.ObjectId(query.tenantId),
    };

    if (!query.includeDeleted) filter.deletedAt = null;
    if (query.inLibrary !== undefined) filter.inLibrary = query.inLibrary;
    if (query.kinds?.length) filter.kind = { $in: query.kinds };
    if (query.sources?.length) filter.source = { $in: query.sources };
    if (query.tags?.length) filter.tags = { $all: query.tags };
    if (query.conversationId && Types.ObjectId.isValid(query.conversationId)) {
      filter.conversationId = new Types.ObjectId(query.conversationId);
    }
    if (query.contactId && Types.ObjectId.isValid(query.contactId)) {
      filter.contactId = new Types.ObjectId(query.contactId);
    }

    // Alcance por número: un agente solo ve el media de los números que tiene
    // asignados. Los assets de biblioteca no cuelgan de ningún número, así que
    // se dejan pasar siempre.
    if (query.phoneNumberIds) {
      const ids = query.phoneNumberIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
      filter.$or = [{ phoneNumberId: { $in: ids } }, { phoneNumberId: null }];
    }

    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    if (query.search?.trim()) {
      const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
      const searchClause = [{ filename: rx }, { title: rx }, { tags: rx }];
      // Sin pisar el $or del alcance por número.
      filter.$and = [...(filter.$and ?? []), { $or: searchClause }];
    }

    return filter;
  }

  async usageSummary(tenantId: string, now: Date): Promise<MediaUsageSummary> {
    const tenantObjectId = new Types.ObjectId(tenantId);

    const [byKind, passthrough] = await Promise.all([
      this.model.aggregate<{ _id: string; count: number; bytes: number }>([
        { $match: { tenantId: tenantObjectId, deletedAt: null, status: MediaAssetStatus.READY } },
        { $group: { _id: '$kind', count: { $sum: 1 }, bytes: { $sum: '$sizeBytes' } } },
      ]),
      this.model.aggregate<{ _id: boolean; count: number; bytes: number }>([
        {
          $match: {
            tenantId: tenantObjectId,
            deletedAt: null,
            status: { $in: [MediaAssetStatus.META_ONLY, MediaAssetStatus.EXPIRED_AT_SOURCE] },
          },
        },
        {
          $group: {
            // true = ya se perdió
            _id: {
              $or: [
                { $eq: ['$status', MediaAssetStatus.EXPIRED_AT_SOURCE] },
                { $lte: ['$metaExpiresAt', now] },
              ],
            },
            count: { $sum: 1 },
            bytes: { $sum: '$sizeBytes' },
          },
        },
      ]),
    ]);

    const lost = passthrough.find((row) => row._id === true);
    const alive = passthrough.find((row) => row._id === false);

    return {
      storedBytes: byKind.reduce((sum, row) => sum + row.bytes, 0),
      storedCount: byKind.reduce((sum, row) => sum + row.count, 0),
      byKind: byKind.map((row) => ({
        kind: row._id as MediaKind,
        count: row.count,
        bytes: row.bytes,
      })),
      metaOnlyCount: alive?.count ?? 0,
      metaOnlyBytes: alive?.bytes ?? 0,
      expiredCount: lost?.count ?? 0,
      expiredBytes: lost?.bytes ?? 0,
    };
  }

  async findBackfillCandidates(tenantId: string, now: Date, limit: number): Promise<MediaAsset[]> {
    const docs = await this.model
      .find(this.backfillFilter(tenantId, now))
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(MediaAssetMapper.toDomain);
  }

  async countBackfillCandidates(tenantId: string, now: Date): Promise<number> {
    return this.model.countDocuments(this.backfillFilter(tenantId, now));
  }

  private backfillFilter(tenantId: string, now: Date): MediaAssetFilter {
    return {
      tenantId: new Types.ObjectId(tenantId),
      status: MediaAssetStatus.META_ONLY,
      metaMediaId: { $ne: null },
      metaExpiresAt: { $gt: now },
      deletedAt: null,
    };
  }

  async markExpiredAtSource(now: Date): Promise<number> {
    const result = await this.model.updateMany(
      {
        status: MediaAssetStatus.META_ONLY,
        metaExpiresAt: { $lte: now },
      },
      { $set: { status: MediaAssetStatus.EXPIRED_AT_SOURCE } },
    );
    return result.modifiedCount ?? 0;
  }

  async findExpiredStored(now: Date, limit: number): Promise<MediaAsset[]> {
    const docs = await this.model
      .find({
        status: MediaAssetStatus.READY,
        expiresAt: { $ne: null, $lte: now },
      })
      .limit(limit);
    return docs.map(MediaAssetMapper.toDomain);
  }

  async hardDelete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await this.model.deleteOne({ _id: new Types.ObjectId(id) });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.model.countDocuments({ tenantId: new Types.ObjectId(tenantId), deletedAt: null });
  }

  async listTags(tenantId: string): Promise<string[]> {
    const tags = await this.model.distinct('tags', {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    });
    return (tags as string[]).filter(Boolean).sort();
  }
}
