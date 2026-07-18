import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TemplateCategory } from '../../../../domain/enums/template-category.enum.js';
import { TemplateQuality } from '../../../../domain/enums/template-quality.enum.js';
import { TemplateStatus } from '../../../../domain/enums/template-status.enum.js';

export type MessageTemplateDocument = HydratedDocument<MessageTemplateModel>;

@Schema({ collection: 'message_templates', timestamps: true })
export class MessageTemplateModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ required: true })
  wabaId: string;

  @Prop({ type: String, default: null })
  metaTemplateId: string | null;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  language: string;

  @Prop({ required: true, enum: TemplateCategory })
  category: string;

  @Prop({ required: true, enum: TemplateStatus, default: TemplateStatus.PENDING })
  status: string;

  @Prop({ required: true, enum: TemplateQuality, default: TemplateQuality.UNKNOWN })
  qualityScore: string;

  @Prop({ type: [Object], required: true, default: [] })
  components: Record<string, unknown>[];

  @Prop({ type: String, default: null })
  rejectionReason: string | null;

  @Prop({ type: Date, default: null })
  lastSyncedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageTemplateSchema = SchemaFactory.createForClass(MessageTemplateModel);

MessageTemplateSchema.index({ tenantId: 1, phoneNumberId: 1, status: 1 });
MessageTemplateSchema.index({ wabaId: 1, name: 1, language: 1 }, { unique: true });
MessageTemplateSchema.index({ metaTemplateId: 1 }, { sparse: true });
