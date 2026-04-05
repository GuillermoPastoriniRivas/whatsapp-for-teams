import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetTokenModel>;

@Schema({ collection: 'password_reset_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class PasswordResetTokenModel {
  @Prop({ type: Types.ObjectId, required: true })
  agentId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true, enum: ['reset', 'invitation'], default: 'reset' })
  type: string;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}

export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetTokenModel);

PasswordResetTokenSchema.index({ agentId: 1 });
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
