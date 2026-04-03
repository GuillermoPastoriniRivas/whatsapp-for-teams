import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BillingRecordDocument = HydratedDocument<BillingRecordModel>;

@Schema({ collection: 'billing_records', timestamps: { createdAt: true, updatedAt: false } })
export class BillingRecordModel {
  @Prop({ required: true, index: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: ['subscription_created', 'plan_changed', 'payment_success', 'subscription_canceled'] })
  eventType: string;

  @Prop({ required: true, enum: ['free', 'pro', 'business', 'agencies'] })
  plan: string;

  @Prop({ required: true })
  amountCents: number;

  @Prop({ required: true })
  description: string;

  createdAt: Date;
}

export const BillingRecordSchema = SchemaFactory.createForClass(BillingRecordModel);
