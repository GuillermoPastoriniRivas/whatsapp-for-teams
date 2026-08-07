import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageDirection } from '../../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';
import { MessageLocation } from '../../../../domain/value-objects/message-location.js';

export type MessageDocument = HydratedDocument<MessageModel>;

@Schema({ collection: 'messages' })
export class MessageModel {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true, enum: MessageDirection })
  direction: string;

  @Prop({ required: true, enum: MessageType })
  messageType: string;

  @Prop({ type: String, default: null })
  body: string | null;

  @Prop({ type: String, default: null })
  mediaUrl: string | null;

  @Prop({ type: String, default: null })
  mimeType: string | null;

  @Prop({ required: true, unique: true })
  waMessageId: string;

  @Prop({ required: true, enum: MessageWaStatus })
  waStatus: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ type: String, default: null })
  senderAgentId: string | null;

  @Prop({ type: String, default: null })
  senderAgentName: string | null;

  /** 'agent' | 'ai' | 'flow' | 'campaign' | 'api'. Null en los previos a ago-2026. */
  @Prop({ type: String, default: null })
  senderKind: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  campaignId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  waErrorCode: string | null;

  @Prop({ type: String, default: null })
  waErrorMessage: string | null;

  @Prop({ type: String, default: null })
  interactiveReplyId: string | null;

  @Prop({ type: String, default: null })
  contextWaMessageId: string | null;

  @Prop({ type: Object, default: null })
  interactivePayload: Record<string, unknown> | null;

  @Prop({ type: Types.ObjectId, default: null })
  mediaAssetId: Types.ObjectId | null;

  @Prop({ type: Object, default: null })
  location: MessageLocation | null;
}

export const MessageSchema = SchemaFactory.createForClass(MessageModel);

MessageSchema.index({ conversationId: 1, timestamp: 1 });
MessageSchema.index({ campaignId: 1 }, { sparse: true });
