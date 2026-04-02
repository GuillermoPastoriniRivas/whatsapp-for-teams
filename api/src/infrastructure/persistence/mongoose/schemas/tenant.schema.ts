import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantDocument = HydratedDocument<TenantModel>;

@Schema({ collection: 'tenants', timestamps: { createdAt: true, updatedAt: false } })
export class TenantModel {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ default: false })
  isDemo: boolean;

  createdAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(TenantModel);
