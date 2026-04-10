import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';

export type ConversationDocument = HydratedDocument<ConversationModel>;

@Schema({ collection: 'conversations', timestamps: { createdAt: true, updatedAt: false } })
export class ConversationModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  contactId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  agentId: Types.ObjectId | null;

  @Prop({ required: true, enum: ConversationStatus, default: ConversationStatus.UNASSIGNED })
  status: string;

  @Prop({ required: true, default: () => new Date() })
  lastMessageAt: Date;

  @Prop({ required: true, default: () => new Date() })
  lastInboundAt: Date;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  @Prop({ type: String, default: null })
  closedBy: string | null;

  @Prop({ type: String, default: null })
  summary: string | null;

  @Prop({ type: Date, default: null })
  pendingAiSince!: Date | null;

  createdAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(ConversationModel);

ConversationSchema.index({ tenantId: 1, status: 1 });
ConversationSchema.index({ contactId: 1, phoneNumberId: 1 }, { unique: true });
ConversationSchema.index({ contactId: 1, phoneNumberId: 1, status: 1 });
