import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscriptionModel>;

@Schema({ collection: 'push_subscriptions', timestamps: { createdAt: true, updatedAt: false } })
export class PushSubscriptionModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  agentId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  endpoint: string;

  @Prop({ type: { p256dh: String, auth: String }, required: true, _id: false })
  keys: { p256dh: string; auth: string };

  @Prop({ type: String, default: null })
  userAgent: string | null;

  createdAt: Date;
}

export const PushSubscriptionSchema = SchemaFactory.createForClass(PushSubscriptionModel);

PushSubscriptionSchema.index({ agentId: 1 });
