import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CampaignRecipientStatus } from '../../../../domain/enums/campaign-recipient-status.enum.js';

export type CampaignRecipientDocument = HydratedDocument<CampaignRecipientModel>;

@Schema({ collection: 'campaign_recipients', timestamps: { createdAt: true, updatedAt: true } })
export class CampaignRecipientModel {
  @Prop({ type: Types.ObjectId, required: true })
  campaignId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  contactId: Types.ObjectId;

  @Prop({ required: true })
  waId: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ type: Object, required: true, default: {} })
  resolvedVariables: Record<string, string>;

  @Prop({ required: true, enum: CampaignRecipientStatus, default: CampaignRecipientStatus.PENDING })
  status: string;

  @Prop({ required: true, default: 0 })
  attemptCount: number;

  @Prop({ type: String, default: null })
  claimToken: string | null;

  @Prop({ type: Date, default: null })
  nextAttemptAt: Date | null;

  @Prop({ type: String, default: null })
  waMessageId: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  messageId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  conversationId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  failureCode: string | null;

  @Prop({ type: String, default: null })
  failureReason: string | null;

  @Prop({ type: Date, default: null })
  sentAt: Date | null;

  @Prop({ type: Date, default: null })
  deliveredAt: Date | null;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  @Prop({ type: Date, default: null })
  repliedAt: Date | null;

  @Prop({ type: Date, default: null })
  replyWindowExpiresAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CampaignRecipientSchema = SchemaFactory.createForClass(CampaignRecipientModel);

CampaignRecipientSchema.index({ campaignId: 1, status: 1, _id: 1 });
CampaignRecipientSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });
CampaignRecipientSchema.index({ waMessageId: 1 }, { sparse: true });
CampaignRecipientSchema.index({ contactId: 1, repliedAt: 1, replyWindowExpiresAt: 1 });
