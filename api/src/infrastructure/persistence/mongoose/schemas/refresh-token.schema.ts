import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshTokenModel>;

@Schema({ collection: 'refresh_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class RefreshTokenModel {
  @Prop({ type: Types.ObjectId, required: true })
  agentId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshTokenModel);

RefreshTokenSchema.index({ agentId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
