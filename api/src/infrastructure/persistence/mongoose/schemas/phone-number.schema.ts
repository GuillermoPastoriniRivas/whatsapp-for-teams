import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessagingProvider } from '../../../../domain/enums/messaging-provider.enum.js';
import { PhoneNumberPlugin } from '../../../../domain/enums/phone-number-plugin.enum.js';
import { PhoneNumberStatus } from '../../../../domain/enums/phone-number-status.enum.js';

export type PhoneNumberDocument = HydratedDocument<PhoneNumberModel>;

@Schema({ collection: 'phone_numbers', timestamps: { createdAt: true, updatedAt: false } })
export class PhoneNumberModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: MessagingProvider })
  provider: string;

  @Prop({ type: Object, required: true })
  providerConfig: Record<string, string>;

  @Prop({ required: true })
  wabaId: string;

  @Prop({ required: true, unique: true })
  phoneNumberId: string;

  @Prop({ required: true })
  displayPhone: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  webhookSecret: string;

  @Prop({ required: true, enum: PhoneNumberStatus, default: PhoneNumberStatus.ACTIVE })
  status: string;

  @Prop({ type: [String], enum: Object.values(PhoneNumberPlugin), default: [] })
  plugins: string[];

  createdAt: Date;
}

export const PhoneNumberSchema = SchemaFactory.createForClass(PhoneNumberModel);
