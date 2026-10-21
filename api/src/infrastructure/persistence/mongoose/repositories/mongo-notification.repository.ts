import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  allowedNotificationSourceStatuses,
} from '../../../../domain/entities/notification.entity.js';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum.js';
import {
  NotificationFilters,
  NotificationRepository,
  NotificationSentPatch,
  NotificationStatusTimestamps,
} from '../../../../domain/repositories/notification.repository.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { NotificationMapper } from '../mappers/notification.mapper.js';
import { NotificationDocument, NotificationModel } from '../schemas/notification.schema.js';

function objectId(value: string | null | undefined): Types.ObjectId | null {
  return value ? new Types.ObjectId(value) : null;
}

@Injectable()
export class MongoNotificationRepository implements NotificationRepository {
  constructor(
    @InjectModel(NotificationModel.name)
    private readonly model: Model<NotificationDocument>,
  ) {}

  async create(notification: Notification): Promise<Notification> {
    const doc = await this.model.create({
      publicId: notification.id,
      tenantId: new Types.ObjectId(notification.tenantId),
      phoneNumberId: objectId(notification.phoneNumberId),
      contactId: objectId(notification.contactId),
      conversationId: objectId(notification.conversationId),
      messageId: objectId(notification.messageId),
      waMessageId: notification.waMessageId,
      to: notification.to,
      templateId: objectId(notification.templateId),
      templateName: notification.templateName,
      variables: notification.variables,
      status: notification.status,
      sendAt: notification.sendAt,
      queuedAt: notification.queuedAt,
      sentAt: notification.sentAt,
      deliveredAt: notification.deliveredAt,
      readAt: notification.readAt,
      failedAt: notification.failedAt,
      failureCode: notification.failureCode,
      failureReason: notification.failureReason,
      metadata: notification.metadata,
      idempotencyKey: notification.idempotencyKey,
      requestHash: notification.requestHash,
      sandbox: notification.sandbox,
      createdByAgentId: objectId(notification.createdByAgentId),
    });
    return NotificationMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Notification | null> {
    const doc = await this.model.findOne({ publicId: id });
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByTenantAndId(tenantId: string, id: string): Promise<Notification | null> {
    const doc = await this.model.findOne({
      publicId: id,
      tenantId: new Types.ObjectId(tenantId),
    });
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
    sandbox: boolean,
  ): Promise<Notification | null> {
    const doc = await this.model.findOne({
      tenantId: new Types.ObjectId(tenantId),
      idempotencyKey,
      sandbox,
    });
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByFilters(filters: NotificationFilters): Promise<PaginatedResult<Notification>> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(filters.tenantId),
    };
    if (filters.status) query.status = filters.status;
    if (filters.templateId) {
      // Un id mal formado no es un 500: es un filtro que no matchea nada.
      if (!Types.ObjectId.isValid(filters.templateId)) {
        return { data: [], meta: { total: 0, page: filters.page, pages: 0 } };
      }
      query.templateId = new Types.ObjectId(filters.templateId);
    }
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit),
      this.model.countDocuments(query),
    ]);

    return {
      data: docs.map(NotificationMapper.toDomain),
      meta: {
        total,
        page: filters.page,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findByWaMessageId(waMessageId: string): Promise<Notification | null> {
    const doc = await this.model.findOne({ waMessageId });
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async updateStatus(
    id: string,
    status: NotificationStatus,
    timestamps: NotificationStatusTimestamps = {},
  ): Promise<Notification | null> {
    const allowed = allowedNotificationSourceStatuses(status);
    if (allowed.length === 0) return null;

    const set: Record<string, unknown> = { status };
    const fields: (keyof NotificationStatusTimestamps)[] = [
      'queuedAt',
      'sentAt',
      'deliveredAt',
      'readAt',
      'failedAt',
      'failureCode',
      'failureReason',
    ];
    for (const field of fields) {
      if (timestamps[field] !== undefined) set[field] = timestamps[field];
    }

    const doc = await this.model.findOneAndUpdate(
      { publicId: id, status: { $in: allowed } },
      { $set: set },
      { new: true },
    );
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async markSent(id: string, patch: NotificationSentPatch): Promise<Notification | null> {
    const doc = await this.model.findOneAndUpdate(
      {
        publicId: id,
        status: { $in: [NotificationStatus.SCHEDULED, NotificationStatus.QUEUED] },
      },
      {
        $set: {
          status: NotificationStatus.SENT,
          messageId: objectId(patch.messageId),
          waMessageId: patch.waMessageId,
          contactId: objectId(patch.contactId),
          conversationId: objectId(patch.conversationId),
          sentAt: patch.sentAt,
        },
      },
      { new: true },
    );
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async cancel(tenantId: string, id: string): Promise<Notification | null> {
    const doc = await this.model.findOneAndUpdate(
      {
        publicId: id,
        tenantId: new Types.ObjectId(tenantId),
        status: NotificationStatus.SCHEDULED,
      },
      { $set: { status: NotificationStatus.CANCELED } },
      { new: true },
    );
    return doc ? NotificationMapper.toDomain(doc) : null;
  }
}
