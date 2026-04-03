import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationLabelDocument = HydratedDocument<ConversationLabelModel>;

@Schema({ collection: 'conversation_labels', timestamps: { createdAt: true, updatedAt: false } })
export class ConversationLabelModel {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  labelId: Types.ObjectId;

  @Prop({ required: true })
  assignedBy: string;

  createdAt: Date;
}

export const ConversationLabelSchema = SchemaFactory.createForClass(ConversationLabelModel);

ConversationLabelSchema.index({ conversationId: 1 });
ConversationLabelSchema.index({ labelId: 1 });
ConversationLabelSchema.index({ conversationId: 1, labelId: 1 }, { unique: true });
