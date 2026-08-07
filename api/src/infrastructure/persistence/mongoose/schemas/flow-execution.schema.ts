import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';
import type { FlowStepLog, FlowWaitState } from '../../../../domain/entities/flow-execution.entity.js';

export type FlowExecutionDocument = HydratedDocument<FlowExecutionModel>;

@Schema({ collection: 'flow_executions', timestamps: true })
export class FlowExecutionModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  flowId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  flowVersionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  contactId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ required: true, enum: FlowExecutionStatus })
  status: string;

  @Prop({ type: String, default: null })
  currentNodeId: string | null;

  @Prop({ required: true })
  resumeToken: string;

  @Prop({ required: true, default: 0 })
  stepCount: number;

  @Prop({ type: Object, default: null })
  waitState: FlowWaitState | null;

  @Prop({ type: String, default: null })
  lastConsumedMessageId: string | null;

  @Prop({ type: Object, required: true, default: {} })
  variables: Record<string, unknown>;

  @Prop({ type: [Object], required: true, default: [] })
  steps: FlowStepLog[];

  @Prop({ type: Object, required: true })
  triggeredBy: { type: 'message' | 'webhook'; messageId?: string };

  @Prop({ type: String, default: null })
  endReason: string | null;

  @Prop({ type: Object, default: null })
  error: { nodeId: string; message: string } | null;

  @Prop({ type: Date, default: null })
  runningSince: Date | null;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const FlowExecutionSchema = SchemaFactory.createForClass(FlowExecutionModel);

// El lock por conversación: máx. 1 ejecución viva (running|waiting|paused).
// Las pausadas cuentan: conservan su punto para retomarse, así que dejarlas
// afuera permitiría arrancar una segunda y tener dos al reanudar.
FlowExecutionSchema.index(
  { conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [FlowExecutionStatus.RUNNING, FlowExecutionStatus.WAITING, FlowExecutionStatus.PAUSED] },
    },
  },
);
// Idempotencia del arranque por mensaje: el job entrante se reintenta y Meta
// reentrega webhooks; sin esto una ejecución ya terminada se volvería a lanzar
// y el cliente recibiría el flujo dos veces.
FlowExecutionSchema.index(
  { 'triggeredBy.messageId': 1 },
  { unique: true, partialFilterExpression: { 'triggeredBy.messageId': { $type: 'string' } } },
);
FlowExecutionSchema.index({ tenantId: 1, flowId: 1, startedAt: -1 });
FlowExecutionSchema.index({ status: 1, runningSince: 1 });
FlowExecutionSchema.index({ status: 1, 'waitState.timeoutAt': 1 });
FlowExecutionSchema.index({ conversationId: 1, startedAt: -1 });
