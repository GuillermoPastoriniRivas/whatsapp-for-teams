import { z } from 'zod';
import { AiProvider } from '../../domain/enums/ai-provider.enum.js';

const HHmm = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm (24h)');
const DayRange = z.object({ open: HHmm, close: HHmm }).nullable();
export const BusinessHoursSchema = z.object({
  monday: DayRange.optional(),
  tuesday: DayRange.optional(),
  wednesday: DayRange.optional(),
  thursday: DayRange.optional(),
  friday: DayRange.optional(),
  saturday: DayRange.optional(),
  sunday: DayRange.optional(),
});

export const UpdateAiAgentConfigRequestSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.nativeEnum(AiProvider).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  systemPrompt: z.string().optional(),
  knowledgeBase: z.string().optional(),
  goals: z.string().optional(),
  persona: z.object({
    role: z.string().min(1),
    tone: z.string().min(1),
    language: z.string().min(1),
    instructions: z.string().default(''),
  }).optional(),
  handoffRules: z.object({
    keywords: z.array(z.string()).optional(),
    maxConsecutiveFailures: z.number().min(0).optional(),
    onCustomerRequest: z.boolean().optional(),
    urgencyKeywords: z.array(z.string()).optional(),
  }).optional(),
  contextConfig: z.object({
    maxHistoryMessages: z.number().min(1).max(100).optional(),
    includeContactInfo: z.boolean().optional(),
  }).optional(),
  rateLimits: z.object({
    maxMessagesPerDay: z.number().min(0).optional(),
    maxTokensPerDay: z.number().min(0).optional(),
  }).optional(),
  multiMessage: z.object({
    enabled: z.boolean(),
    maxBubbles: z.number().min(1).max(10).optional(),
    interBubbleDelayMs: z.number().min(0).max(5000).optional(),
    debounceWindowMs: z.number().min(0).max(10000).optional(),
    debounceMaxWaitMs: z.number().min(0).max(60000).optional(),
  }).optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().min(1).nullable().optional(),
  businessHours: BusinessHoursSchema.nullable().optional(),
});

export type UpdateAiAgentConfigRequestDto = z.infer<typeof UpdateAiAgentConfigRequestSchema>;
