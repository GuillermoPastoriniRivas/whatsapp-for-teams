import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AiProvider } from '../../../../domain/enums/ai-provider.enum.js';

export type AiAgentConfigDocument = HydratedDocument<AiAgentConfigModel>;

@Schema({ collection: 'ai_agent_configs', timestamps: true })
export class AiAgentConfigModel {
  @Prop({ type: Types.ObjectId, required: true, unique: true })
  agentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: AiProvider })
  provider: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  apiKey: string;

  @Prop({ required: false, default: '' })
  systemPrompt: string;

  @Prop({ required: false, default: '' })
  knowledgeBase: string;

  @Prop({ type: Object, required: true })
  persona: { role: string; tone: string; language: string; instructions: string };

  @Prop({ type: Object, required: true })
  handoffRules: { keywords: string[]; maxConsecutiveFailures: number; onCustomerRequest: boolean; urgencyKeywords: string[] };

  @Prop({ type: Object, required: true })
  contextConfig: { maxHistoryMessages: number; includeContactInfo: boolean };

  @Prop({ type: Object, required: true })
  rateLimits: { maxMessagesPerDay: number; maxTokensPerDay: number };

  @Prop({ required: false, default: '' })
  goals: string;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({
    type: Object,
    default: { enabled: false, maxBubbles: 4, interBubbleDelayMs: 1200, debounceWindowMs: 2000, debounceMaxWaitMs: 20000 },
  })
  multiMessage: { enabled: boolean; maxBubbles: number; interBubbleDelayMs: number; debounceWindowMs: number; debounceMaxWaitMs: number };

  @Prop({ type: String, required: false, default: null })
  timezone: string | null;

  @Prop({ type: Object, required: false, default: null })
  businessHours: Record<string, { open: string; close: string } | null> | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AiAgentConfigSchema = SchemaFactory.createForClass(AiAgentConfigModel);
