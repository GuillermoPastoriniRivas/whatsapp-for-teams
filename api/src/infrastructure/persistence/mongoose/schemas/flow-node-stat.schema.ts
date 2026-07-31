import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FlowNodeStatDocument = HydratedDocument<FlowNodeStatModel>;

@Schema({ collection: 'flow_node_stats' })
export class FlowNodeStatModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  flowId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  flowVersionId: Types.ObjectId;

  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true, default: 0 })
  entered: number;

  @Prop({ required: true, default: 0 })
  errors: number;

  @Prop({ type: Object, required: true, default: {} })
  outcomes: Record<string, number>;
}

export const FlowNodeStatSchema = SchemaFactory.createForClass(FlowNodeStatModel);

FlowNodeStatSchema.index({ flowVersionId: 1, nodeId: 1, date: 1 }, { unique: true });
FlowNodeStatSchema.index({ flowId: 1, date: 1 });
