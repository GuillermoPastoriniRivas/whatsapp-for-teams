import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiUsageDocument = HydratedDocument<AiUsageModel>;

@Schema({ collection: 'ai_usage' })
export class AiUsageModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true, default: 0 })
  messageCount: number;

  @Prop({ required: true, default: 0 })
  tokenCount: number;
}

export const AiUsageSchema = SchemaFactory.createForClass(AiUsageModel);

// El consumo se acumula por cuenta y día. Las filas viejas, que además tenían
// aiAgentId, quedan fuera de este índice y las borra el script de migración.
AiUsageSchema.index({ tenantId: 1, date: 1 }, { unique: true });
