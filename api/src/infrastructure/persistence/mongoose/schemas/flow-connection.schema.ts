import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FlowConnectionDocument = HydratedDocument<FlowConnectionModel>;

@Schema({ collection: 'flow_connections', timestamps: true })
export class FlowConnectionModel {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  headerName: string;

  @Prop({ required: true })
  secretEncrypted: string;

  createdAt: Date;
  updatedAt: Date;
}

export const FlowConnectionSchema = SchemaFactory.createForClass(FlowConnectionModel);
