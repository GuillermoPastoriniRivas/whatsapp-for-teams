import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum.js';

export type NotificationDocument = HydratedDocument<NotificationModel>;

/**
 * Recurso `Notification` de la API pública.
 *
 * `publicId` (`ntf_...`) es lo que ve el desarrollador; el `_id` de Mongo no
 * sale nunca. `messageId`/`waMessageId` enlazan con el mensaje real cuando el
 * envío salió, y `idempotencyKey` es lo que hace que reintentar no duplique.
 */
@Schema({ collection: 'notifications', timestamps: true })
export class NotificationModel {
  @Prop({ required: true, unique: true, index: true })
  publicId: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  phoneNumberId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  contactId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  conversationId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  messageId: Types.ObjectId | null;

  /** wamid de Meta o id simulado en sandbox. Null hasta que sale. */
  @Prop({ type: String, default: null, index: true })
  waMessageId: string | null;

  /** Destinatario normalizado (dígitos, sin +). */
  @Prop({ type: String, default: null })
  to: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  templateId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  templateName: string | null;

  @Prop({ type: Object, default: {} })
  variables: Record<string, string>;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.QUEUED,
    index: true,
  })
  status: NotificationStatus;

  /** Hora pedida de salida. Null = inmediata. */
  @Prop({ type: Date, default: null })
  sendAt: Date | null;

  @Prop({ type: Date, default: null })
  queuedAt: Date | null;

  @Prop({ type: Date, default: null })
  sentAt: Date | null;

  @Prop({ type: Date, default: null })
  deliveredAt: Date | null;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  @Prop({ type: Date, default: null })
  failedAt: Date | null;

  @Prop({ type: String, default: null })
  failureCode: string | null;

  @Prop({ type: String, default: null })
  failureReason: string | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ type: String, default: null })
  idempotencyKey: string | null;

  @Prop({ type: String, default: null })
  requestHash: string | null;

  @Prop({ type: Boolean, default: false })
  sandbox: boolean;

  @Prop({ type: Types.ObjectId, default: null })
  createdByAgentId: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(NotificationModel);

NotificationSchema.index({ tenantId: 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, templateId: 1, createdAt: -1 });

/**
 * Idempotencia por cuenta y modo. El índice es parcial para que las
 * notificaciones sin clave (las que crea un job interno) no colisionen entre
 * sí por `null`.
 */
NotificationSchema.index(
  { tenantId: 1, sandbox: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
