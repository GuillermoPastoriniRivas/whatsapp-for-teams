import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationNoteDocument = HydratedDocument<ConversationNoteModel>;

@Schema({ collection: 'conversation_notes', timestamps: { createdAt: true, updatedAt: false } })
export class ConversationNoteModel {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  /** Null cuando la nota la dejó el asistente y no una persona. */
  @Prop({ type: String, default: null })
  authorId: string | null;

  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true })
  body: string;

  createdAt: Date;
}

export const ConversationNoteSchema = SchemaFactory.createForClass(ConversationNoteModel);

ConversationNoteSchema.index({ conversationId: 1, createdAt: 1 });
