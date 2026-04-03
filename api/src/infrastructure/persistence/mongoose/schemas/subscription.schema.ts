import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<SubscriptionModel>;

@Schema({ collection: 'subscriptions', timestamps: { createdAt: true, updatedAt: false } })
export class SubscriptionModel {
  @Prop({ required: true, unique: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: ['free', 'pro', 'business', 'agencies'] })
  plan: string;

  @Prop({ required: true, enum: ['active', 'canceled', 'past_due'] })
  status: string;

  @Prop({ required: true })
  currentPeriodStart: Date;

  @Prop({ required: true })
  currentPeriodEnd: Date;

  @Prop({ type: Date, default: null })
  canceledAt: Date | null;

  @Prop({ type: String, default: null })
  scheduledPlan: string | null;

  createdAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(SubscriptionModel);
