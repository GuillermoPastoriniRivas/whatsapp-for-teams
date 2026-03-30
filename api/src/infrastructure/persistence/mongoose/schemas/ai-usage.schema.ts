import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiUsageDocument = HydratedDocument<AiUsageModel>;

@Schema({ collection: 'ai_usage' })
export class AiUsageModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  aiAgentId: Types.ObjectId;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true, default: 0 })
  messageCount: number;

  @Prop({ required: true, default: 0 })
  tokenCount: number;
}

export const AiUsageSchema = SchemaFactory.createForClass(AiUsageModel);

AiUsageSchema.index({ tenantId: 1, aiAgentId: 1, date: 1 }, { unique: true });
