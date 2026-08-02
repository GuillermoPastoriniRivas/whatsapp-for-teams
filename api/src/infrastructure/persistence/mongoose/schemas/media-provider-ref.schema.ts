import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MediaProviderRefDocument = HydratedDocument<MediaProviderRefModel>;

@Schema({ collection: 'media_provider_refs', timestamps: { createdAt: true, updatedAt: false } })
export class MediaProviderRefModel {
  @Prop({ type: Types.ObjectId, required: true })
  assetId: Types.ObjectId;

  /** Id interno del PhoneNumber, no el phone_number_id de Meta. */
  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ required: true })
  providerMediaId: string;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}

export const MediaProviderRefSchema = SchemaFactory.createForClass(MediaProviderRefModel);

MediaProviderRefSchema.index({ assetId: 1, phoneNumberId: 1 }, { unique: true });
// Mongo limpia solo las referencias vencidas.
MediaProviderRefSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
