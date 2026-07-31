import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { FlowGraph } from '../../../../domain/entities/flow.entity.js';
import type { FlowTriggerIndex } from '../../../../domain/entities/flow-version.entity.js';

export type FlowVersionDocument = HydratedDocument<FlowVersionModel>;

// Inmutable: solo createdAt.
@Schema({ collection: 'flow_versions', timestamps: { createdAt: true, updatedAt: false } })
export class FlowVersionModel {
  @Prop({ type: Types.ObjectId, required: true })
  flowId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  version: number;

  @Prop({ type: Object, required: true })
  graph: FlowGraph;

  @Prop({ type: Object, required: true })
  trigger: FlowTriggerIndex;

  @Prop({ type: Types.ObjectId, required: true })
  publishedByAgentId: Types.ObjectId;

  createdAt: Date;
}

export const FlowVersionSchema = SchemaFactory.createForClass(FlowVersionModel);

FlowVersionSchema.index({ flowId: 1, version: -1 }, { unique: true });
