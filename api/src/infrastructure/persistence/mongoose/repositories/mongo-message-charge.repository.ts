import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import type {
  MessageChargeRepository,
  RecordSentInput,
  UsageBucket,
  UsageQuery,
} from '../../../../domain/repositories/message-charge.repository.js';
import type { ChargeRate, MessageCharge } from '../../../../domain/entities/message-charge.entity.js';
import type { MetaPricingSnapshot } from '../../../../domain/value-objects/meta-pricing.js';
import { MessageChargeModel, MessageChargeDocument } from '../schemas/message-charge.schema.js';
import { MessageChargeMapper } from '../mappers/message-charge.mapper.js';

const oid = (value: string | null | undefined): Types.ObjectId | null =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;

/** Cómo se agrupa el uso. `day` sale del sello de entrega, que es lo que se cobra. */
const GROUP_KEYS: Record<NonNullable<UsageQuery['groupBy']>, unknown> = {
  // La de Meta gana; la nuestra sólo cubre lo que todavía no se entregó.
  category: { $ifNull: ['$meta.category', '$estimatedCategory'] },
  senderKind: '$senderKind',
  phoneNumber: { $toString: '$phoneNumberId' },
  template: { $toString: '$templateId' },
  campaign: { $toString: '$campaignId' },
  ad: { $ifNull: ['$adSourceId', 'sin anuncio'] },
  country: { $ifNull: ['$destinationCountry', 'desconocido'] },
  day: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$deliveredAt', '$sentAt'] } } },
};

@Injectable()
export class MongoMessageChargeRepository implements MessageChargeRepository {
  constructor(
    @InjectModel(MessageChargeModel.name) private readonly model: Model<MessageChargeDocument>,
  ) {}

  async recordSent(input: RecordSentInput): Promise<MessageCharge> {
    // `$setOnInsert` y no `$set`: un reintento que devuelve el mismo wamid no
    // puede volver a contar, ni pisar el contexto congelado del primer envío.
    const doc = await this.model.findOneAndUpdate(
      { waMessageId: input.waMessageId },
      {
        $setOnInsert: {
          tenantId: new Types.ObjectId(input.tenantId),
          phoneNumberId: new Types.ObjectId(input.phoneNumberId),
          conversationId: oid(input.conversationId),
          messageId: oid(input.messageId),
          contactId: oid(input.contactId),
          destinationCountry: input.destinationCountry,
          destinationPrefix: input.destinationPrefix,
          sentAt: input.sentAt,
          senderKind: input.senderKind,
          campaignId: oid(input.campaignId),
          adSourceId: input.adSourceId,
          flowId: oid(input.flowId),
          isTemplate: input.isTemplate,
          templateId: oid(input.templateId),
          templateCategory: input.templateCategory,
          marketingLite: input.marketingLite,
          estimatedCategory: input.estimatedCategory,
          freeEntryPoint: input.freeEntryPoint,
          windowOpen: input.windowOpen,
          source: input.source,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return MessageChargeMapper.toDomain(doc!);
  }

  async stampDelivered(
    waMessageId: string,
    deliveredAt: Date,
    pricing: MetaPricingSnapshot | null,
    fallback?: Pick<RecordSentInput, 'tenantId' | 'phoneNumberId' | 'conversationId' | 'senderKind'>,
  ): Promise<MessageCharge | null> {
    // Write-once en los dos campos: Meta reenvía el mismo `delivered` y manda
    // `read` después, y ninguno de los dos puede correr el sello ni pisar el
    // cobro que ya habíamos guardado.
    const update: Record<string, unknown> = {
      $set: { deliveredAt: { $ifNull: ['$deliveredAt', deliveredAt] } },
    };
    if (pricing) {
      (update.$set as Record<string, unknown>).meta = { $ifNull: ['$meta', pricing] };
    }

    const existing = await this.model.findOneAndUpdate({ waMessageId }, [update], {
      returnDocument: 'after',
    });
    if (existing) return MessageChargeMapper.toDomain(existing);

    // No hay envío registrado: el mensaje salió antes de que existiera el
    // ledger. Se crea igual — el `pricing` de Meta llega una sola vez y
    // perderlo es perderlo para siempre. Queda marcado como huérfano para que
    // nadie lo confunda con un registro completo.
    if (!fallback) return null;

    const created = await this.model.findOneAndUpdate(
      { waMessageId },
      {
        $setOnInsert: {
          tenantId: new Types.ObjectId(fallback.tenantId),
          phoneNumberId: new Types.ObjectId(fallback.phoneNumberId),
          conversationId: oid(fallback.conversationId),
          messageId: null,
          contactId: null,
          destinationCountry: null,
          destinationPrefix: null,
          sentAt: deliveredAt,
          deliveredAt,
          senderKind: fallback.senderKind,
          campaignId: null,
          adSourceId: null,
          flowId: null,
          isTemplate: false,
          templateId: null,
          templateCategory: null,
          marketingLite: false,
          estimatedCategory: 'service',
          freeEntryPoint: false,
          windowOpen: true,
          meta: pricing,
          source: 'orphan',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return created ? MessageChargeMapper.toDomain(created) : null;
  }

  async stampFailed(waMessageId: string, failedAt: Date, errorCode: string | null): Promise<MessageCharge | null> {
    const doc = await this.model.findOneAndUpdate(
      { waMessageId },
      [{ $set: { failedAt: { $ifNull: ['$failedAt', failedAt] }, waErrorCode: errorCode } }],
      { returnDocument: 'after' },
    );
    return doc ? MessageChargeMapper.toDomain(doc) : null;
  }

  async linkMessage(waMessageId: string, messageId: string, conversationId: string | null): Promise<void> {
    await this.model.updateOne({ waMessageId }, [
      {
        $set: {
          messageId: { $ifNull: ['$messageId', oid(messageId)] },
          conversationId: { $ifNull: ['$conversationId', oid(conversationId)] },
        },
      },
    ]);
  }

  async findByWaMessageId(waMessageId: string): Promise<MessageCharge | null> {
    const doc = await this.model.findOne({ waMessageId });
    return doc ? MessageChargeMapper.toDomain(doc) : null;
  }

  async findUnrated(limit: number): Promise<MessageCharge[]> {
    const docs = await this.model
      .find({ rate: null, deliveredAt: { $ne: null } })
      .sort({ deliveredAt: 1 })
      .limit(limit);
    return docs.map(MessageChargeMapper.toDomain);
  }

  async setRate(id: string, rate: ChargeRate): Promise<void> {
    await this.model.updateOne({ _id: new Types.ObjectId(id) }, { $set: { rate } });
  }

  async usage(query: UsageQuery): Promise<UsageBucket[]> {
    // El rango se aplica sobre la entrega cuando la hay y sobre el envío cuando
    // no: si no, los enviados que todavía no se entregaron desaparecen del
    // período y el total no cierra con lo que el cliente ve en el chat.
    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(query.tenantId),
      $expr: {
        $and: [
          { $gte: [{ $ifNull: ['$deliveredAt', '$sentAt'] }, query.from] },
          { $lt: [{ $ifNull: ['$deliveredAt', '$sentAt'] }, query.to] },
        ],
      },
    };
    if (query.phoneNumberId) match.phoneNumberId = new Types.ObjectId(query.phoneNumberId);

    const groupKey = query.groupBy ? GROUP_KEYS[query.groupBy] : 'total';

    // Facturable = lo dijo Meta. Si todavía no dijo nada, se usa nuestra
    // estimación (todo lo entregado fuera del free entry point).
    const billable = {
      $cond: [
        { $ne: [{ $ifNull: ['$meta.billable', null] }, null] },
        '$meta.billable',
        { $not: ['$freeEntryPoint'] },
      ],
    };

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: groupKey,
          billable: {
            $sum: { $cond: [{ $and: [{ $ne: ['$deliveredAt', null] }, billable] }, 1, 0] },
          },
          free: {
            $sum: { $cond: [{ $and: [{ $ne: ['$deliveredAt', null] }, { $not: [billable] }] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $and: [{ $eq: ['$deliveredAt', null] }, { $eq: ['$failedAt', null] }] }, 1, 0] },
          },
          failed: { $sum: { $cond: [{ $ne: ['$failedAt', null] }, 1, 0] } },
          amount: { $sum: { $ifNull: ['$rate.amount', 0] } },
          rated: { $sum: { $cond: [{ $ne: ['$rate', null] }, 1, 0] } },
          currency: { $first: '$rate.currency' },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await this.model.aggregate(pipeline);
    return rows.map((row) => ({
      key: String(row._id ?? 'desconocido'),
      billable: row.billable ?? 0,
      free: row.free ?? 0,
      pending: row.pending ?? 0,
      failed: row.failed ?? 0,
      // Null y no 0 cuando no se tarifó nada: "todavía no sabemos" y "sale
      // cero" son cosas distintas y mostrarlas igual es mentir.
      amount: row.rated > 0 ? row.amount : null,
      currency: row.currency ?? null,
    }));
  }

  async countDelivered(tenantId: string, from: Date, to: Date): Promise<number> {
    return this.model.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      deliveredAt: { $gte: from, $lt: to },
    });
  }
}
