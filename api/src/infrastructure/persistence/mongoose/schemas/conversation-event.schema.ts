import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ConversationEventType } from '../../../../domain/enums/conversation-event-type.enum.js';

export type ConversationEventDocument = HydratedDocument<ConversationEventModel>;

@Schema({ collection: 'conversation_events', timestamps: { createdAt: true, updatedAt: false } })
export class ConversationEventModel {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: ConversationEventType })
  type: string;

  @Prop({ type: String, default: null })
  performedBy: string | null;

  @Prop({ type: Object, default: {} })
  data: Record<string, unknown>;

  createdAt: Date;
}

export const ConversationEventSchema = SchemaFactory.createForClass(ConversationEventModel);

ConversationEventSchema.index({ conversationId: 1, createdAt: 1 });
ConversationEventSchema.index({ tenantId: 1 });
