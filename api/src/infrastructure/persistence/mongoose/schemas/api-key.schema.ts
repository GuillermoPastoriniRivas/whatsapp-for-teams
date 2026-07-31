import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKeyModel>;

@Schema({ collection: 'api_keys', timestamps: { createdAt: true, updatedAt: false } })
export class ApiKeyModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  prefix: string;

  @Prop({ required: true })
  keyHash: string;

  @Prop({ type: Types.ObjectId, default: null })
  createdBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  createdAt: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKeyModel);

ApiKeySchema.index({ tenantId: 1 });
// La búsqueda por hash es el camino caliente de autenticación de la API pública
ApiKeySchema.index({ keyHash: 1 }, { unique: true });
