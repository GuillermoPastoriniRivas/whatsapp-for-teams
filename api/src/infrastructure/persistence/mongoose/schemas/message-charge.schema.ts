import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { MetaPricingSnapshot } from '../../../../domain/value-objects/meta-pricing.js';
import type { ChargeRate, ChargeSource } from '../../../../domain/entities/message-charge.entity.js';

export type MessageChargeDocument = HydratedDocument<MessageChargeModel>;

/**
 * Libro contable de salientes. Una fila por wamid, append-only en lo que
 * importa: `deliveredAt`, `failedAt` y `meta` se escriben una sola vez.
 */
@Schema({ collection: 'message_charges' })
export class MessageChargeModel {
  @Prop({ required: true, unique: true })
  waMessageId: string;

  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  /** Null cuando el saliente no cuelga de ningún chat (aviso a un tercero). */
  @Prop({ type: Types.ObjectId, default: null })
  conversationId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  messageId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  contactId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  destinationCountry: string | null;

  @Prop({ type: String, default: null })
  destinationPrefix: string | null;

  @Prop({ required: true })
  sentAt: Date;

  @Prop({ type: Date, default: null })
  deliveredAt: Date | null;

  @Prop({ type: Date, default: null })
  failedAt: Date | null;

  @Prop({ type: String, default: null })
  waErrorCode: string | null;

  @Prop({ required: true })
  senderKind: string;

  @Prop({ type: Types.ObjectId, default: null })
  campaignId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  adSourceId: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  flowId: Types.ObjectId | null;

  @Prop({ required: true, default: false })
  isTemplate: boolean;

  @Prop({ type: Types.ObjectId, default: null })
  templateId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  templateCategory: string | null;

  @Prop({ required: true, default: false })
  marketingLite: boolean;

  @Prop({ required: true })
  estimatedCategory: string;

  @Prop({ required: true, default: false })
  freeEntryPoint: boolean;

  @Prop({ required: true, default: true })
  windowOpen: boolean;

  /** Lo que dijo Meta al entregar. Null hasta que llega el webhook. */
  @Prop({ type: Object, default: null })
  meta: MetaPricingSnapshot | null;

  @Prop({ type: Object, default: null })
  rate: ChargeRate | null;

  @Prop({ required: true, default: 'live' })
  source: ChargeSource;
}

export const MessageChargeSchema = SchemaFactory.createForClass(MessageChargeModel);

// La consulta que importa es "qué se entregó en este período para esta cuenta".
MessageChargeSchema.index({ tenantId: 1, deliveredAt: 1 });
MessageChargeSchema.index({ tenantId: 1, sentAt: 1 });
MessageChargeSchema.index({ phoneNumberId: 1, deliveredAt: 1 });
// Cola del job de tarifación: `{ rate: null, deliveredAt: { $ne: null } }`. El
// orden importa — `rate` primero, que es el campo selectivo. No se usa un índice
// parcial porque la igualdad a null en `partialFilterExpression` también matchea
// el campo ausente, y ahí el índice deja de cubrir la consulta de forma obvia.
MessageChargeSchema.index({ rate: 1, deliveredAt: 1 });
