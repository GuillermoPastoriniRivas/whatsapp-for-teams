import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { EvaluationRunSummary, EvaluationVerdict } from '../../../../domain/entities/evaluation.entity.js';

export type EvaluationCaseDocument = HydratedDocument<EvaluationCaseModel>;

@Schema({ collection: 'evaluation_cases', timestamps: { createdAt: true, updatedAt: false } })
export class EvaluationCaseModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  question: string;

  @Prop({ default: '' })
  expectation: string;

  @Prop({ default: false })
  expectHandoff: boolean;

  createdAt: Date;
}

export const EvaluationCaseSchema = SchemaFactory.createForClass(EvaluationCaseModel);
EvaluationCaseSchema.index({ tenantId: 1, createdAt: -1 });

export type EvaluationRunDocument = HydratedDocument<EvaluationRunModel>;

@Schema({ collection: 'evaluation_runs', timestamps: { createdAt: true, updatedAt: false } })
export class EvaluationRunModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  summary: EvaluationRunSummary;

  @Prop({ type: [Object], default: [] })
  verdicts: EvaluationVerdict[];

  createdAt: Date;
}

export const EvaluationRunSchema = SchemaFactory.createForClass(EvaluationRunModel);
EvaluationRunSchema.index({ tenantId: 1, createdAt: -1 });
