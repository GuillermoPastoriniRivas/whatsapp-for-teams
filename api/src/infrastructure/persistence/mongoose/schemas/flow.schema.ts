import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FlowStatus } from '../../../../domain/enums/flow-status.enum.js';
import type { FlowGraph, FlowStats } from '../../../../domain/entities/flow.entity.js';

export type FlowDocument = HydratedDocument<FlowModel>;

@Schema({ collection: 'flows', timestamps: true })
export class FlowModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ required: true, enum: FlowStatus, default: FlowStatus.DRAFT })
  status: string;

  @Prop({ type: Object, required: true, default: { nodes: [], edges: [] } })
  draftGraph: FlowGraph;

  @Prop({ type: Types.ObjectId, default: null })
  publishedVersionId: Types.ObjectId | null;

  @Prop({ type: Number, default: null })
  publishedVersion: number | null;

  @Prop({ required: true, default: 100 })
  priority: number;

  @Prop({ type: String, default: null })
  webhookToken: string | null;

  @Prop({ type: Object, required: true, default: { started: 0, completed: 0, failed: 0, cancelled: 0 } })
  stats: FlowStats;

  @Prop({ type: Types.ObjectId, required: true })
  createdByAgentId: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const FlowSchema = SchemaFactory.createForClass(FlowModel);

FlowSchema.index({ tenantId: 1, status: 1, priority: 1 });
FlowSchema.index({ tenantId: 1, updatedAt: -1 });
