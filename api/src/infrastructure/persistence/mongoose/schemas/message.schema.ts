import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageDirection } from '../../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';

export type MessageDocument = HydratedDocument<MessageModel>;

@Schema({ collection: 'messages' })
export class MessageModel {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true, enum: MessageDirection })
  direction: string;

  @Prop({ required: true, enum: MessageType })
  messageType: string;

  @Prop({ default: null })
  body: string | null;

  @Prop({ default: null })
  mediaUrl: string | null;

  @Prop({ default: null })
  mimeType: string | null;

  @Prop({ required: true, unique: true })
  waMessageId: string;

  @Prop({ required: true, enum: MessageWaStatus })
  waStatus: string;

  @Prop({ required: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(MessageModel);

MessageSchema.index({ conversationId: 1, timestamp: 1 });
