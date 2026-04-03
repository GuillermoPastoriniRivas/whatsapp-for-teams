import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LabelDocument = HydratedDocument<LabelModel>;

@Schema({ collection: 'labels', timestamps: { createdAt: true, updatedAt: false } })
export class LabelModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  color: string;

  createdAt: Date;
}

export const LabelSchema = SchemaFactory.createForClass(LabelModel);

LabelSchema.index({ tenantId: 1 });
LabelSchema.index({ tenantId: 1, name: 1 }, { unique: true });
