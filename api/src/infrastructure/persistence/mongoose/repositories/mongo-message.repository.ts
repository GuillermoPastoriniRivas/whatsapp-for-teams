import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MessageRepository,
  StatusUpdateOptions,
  UpsertMessageInput,
} from '../../../../domain/repositories/message.repository.js';
import { Message } from '../../../../domain/entities/message.entity.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { MessageModel, MessageDocument } from '../schemas/message.schema.js';
import { MessageMapper } from '../mappers/message.mapper.js';

/**
 * Orden de avance de los estados. `failed` va último a propósito: es terminal y
 * trae el motivo, así que gana sobre cualquier estado previo. Un estado
 * desconocido da -1 en `$indexOfArray`, y entonces cualquier entrante lo pisa.
 */
const STATUS_ORDER: string[] = [
  MessageWaStatus.SENT,
  MessageWaStatus.DELIVERED,
  MessageWaStatus.READ,
  MessageWaStatus.FAILED,
];

/** Un `read` prueba la entrega aunque el `delivered` nunca haya llegado. */
const IMPLIES_DELIVERED = new Set<string>([MessageWaStatus.DELIVERED, MessageWaStatus.READ]);

@Injectable()
export class MongoMessageRepository implements MessageRepository {
  constructor(
    @InjectModel(MessageModel.name) private readonly model: Model<MessageDocument>,
  ) {}

  async upsertByWaMessageId(message: UpsertMessageInput): Promise<Message> {
    const doc = await this.model.findOneAndUpdate(
      { waMessageId: message.waMessageId },
      {
        $setOnInsert: {
          conversationId: new Types.ObjectId(message.conversationId),
          direction: message.direction,
          messageType: message.messageType,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mimeType: message.mimeType,
          waStatus: message.waStatus,
          timestamp: message.timestamp,
          senderAgentId: message.senderAgentId,
          senderAgentName: message.senderAgentName,
          campaignId: message.campaignId ? new Types.ObjectId(message.campaignId) : null,
          interactiveReplyId: message.interactiveReplyId ?? null,
          contextWaMessageId: message.contextWaMessageId ?? null,
          interactivePayload: message.interactivePayload ?? null,
          mediaAssetId: message.mediaAssetId ? new Types.ObjectId(message.mediaAssetId) : null,
          location: message.location ?? null,
          // Estaba en el schema y en la entidad, pero no se escribía nunca: los
          // mensajes de la IA y los de un flujo quedaban los dos con
          // `senderAgentId` null y eran indistinguibles.
          senderKind: message.senderKind ?? null,
          referral: message.referral ?? null,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return MessageMapper.toDomain(doc!);
  }

  async findById(id: string): Promise<Message | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id);
    return doc ? MessageMapper.toDomain(doc) : null;
  }

  async attachMediaAsset(messageId: string, mediaAssetId: string): Promise<Message | null> {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(mediaAssetId)) return null;
    const doc = await this.model.findByIdAndUpdate(
      messageId,
      { $set: { mediaAssetId: new Types.ObjectId(mediaAssetId) } },
      { returnDocument: 'after' },
    );
    return doc ? MessageMapper.toDomain(doc) : null;
  }

  async findByConversationId(conversationId: string, page: number, limit: number): Promise<PaginatedResult<Message>> {
    const filter = { conversationId: new Types.ObjectId(conversationId) };

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.model.countDocuments(filter),
    ]);

    return {
      data: docs.map(MessageMapper.toDomain).reverse(),
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatusByWaMessageId(
    waMessageId: string,
    waStatus: MessageWaStatus,
    options: StatusUpdateOptions = {},
  ): Promise<Message | null> {
    const { error, occurredAt } = options;
    const stamp = occurredAt ?? new Date();
    const incomingRank = STATUS_ORDER.indexOf(waStatus);

    // Los webhooks de Meta no vienen ordenados: un `sent` que llega tarde
    // degradaba un `read`. Todo se resuelve en un solo update con pipeline de
    // agregación para que sea atómico — con read-then-write, dos webhooks
    // simultáneos se pisan igual.
    const doc = await this.model.findOneAndUpdate(
      { waMessageId },
      [
        {
          $set: {
            waStatus: {
              $cond: [
                { $gt: [incomingRank, { $indexOfArray: [STATUS_ORDER, '$waStatus'] }] },
                waStatus,
                '$waStatus',
              ],
            },
            // `read` implica entregado: si el `delivered` se perdió, el sello de
            // entrega sale igual. Write-once: el primero que llega manda.
            ...(IMPLIES_DELIVERED.has(waStatus)
              ? { deliveredAt: { $ifNull: ['$deliveredAt', stamp] } }
              : {}),
            ...(waStatus === MessageWaStatus.FAILED
              ? { failedAt: { $ifNull: ['$failedAt', stamp] } }
              : {}),
            ...(error ? { waErrorCode: error.code, waErrorMessage: error.message } : {}),
          },
        },
      ],
      { returnDocument: 'after' },
    );
    return doc ? MessageMapper.toDomain(doc) : null;
  }
}
