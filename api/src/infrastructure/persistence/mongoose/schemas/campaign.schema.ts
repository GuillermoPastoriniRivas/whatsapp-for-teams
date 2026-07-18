import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CampaignStatus } from '../../../../domain/enums/campaign-status.enum.js';
import type {
  CampaignAudience,
  CampaignCounts,
  CampaignThrottle,
  CampaignVariableMapping,
} from '../../../../domain/entities/campaign.entity.js';

export type CampaignDocument = HydratedDocument<CampaignModel>;

@Schema({ collection: 'campaigns', timestamps: true })
export class CampaignModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  templateId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: string;

  @Prop({ type: [Object], required: true, default: [] })
  variableMappings: CampaignVariableMapping[];

  @Prop({ type: Object, required: true })
  audience: CampaignAudience;

  @Prop({ type: Date, default: null })
  scheduledAt: Date | null;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Object, required: true, default: { messagesPerSecond: 10, batchSize: 50 } })
  throttle: CampaignThrottle;

  @Prop({ required: true, default: 72 })
  replyWindowHours: number;

  @Prop({
    type: Object,
    required: true,
    default: { total: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, replied: 0 },
  })
  counts: CampaignCounts;

  @Prop({ type: Types.ObjectId, required: true })
  createdByAgentId: Types.ObjectId;

  @Prop({ type: String, default: null })
  failureReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(CampaignModel);

CampaignSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
CampaignSchema.index({ phoneNumberId: 1, status: 1 });
CampaignSchema.index({ templateId: 1, status: 1 });
