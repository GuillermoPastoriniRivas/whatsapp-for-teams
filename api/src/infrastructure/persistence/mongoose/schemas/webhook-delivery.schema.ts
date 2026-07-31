import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WebhookDeliveryDocument = HydratedDocument<WebhookDeliveryModel>;

@Schema({ collection: 'webhook_deliveries', timestamps: { createdAt: true, updatedAt: false } })
export class WebhookDeliveryModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  endpointId: Types.ObjectId;

  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ required: true, enum: ['pending', 'success', 'failed'], default: 'pending' })
  status: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ type: Number, default: null })
  responseStatus: number | null;

  @Prop({ type: String, default: null })
  responseBody: string | null;

  @Prop({ type: String, default: null })
  lastError: string | null;

  @Prop({ type: Date, default: null })
  lastAttemptAt: Date | null;

  @Prop({ type: Date, default: null })
  nextRetryAt: Date | null;

  createdAt: Date;
}

export const WebhookDeliverySchema = SchemaFactory.createForClass(WebhookDeliveryModel);

WebhookDeliverySchema.index({ endpointId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ tenantId: 1, createdAt: -1 });
// TTL: el log de entregas expira a los 30 días para no crecer sin límite
WebhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
