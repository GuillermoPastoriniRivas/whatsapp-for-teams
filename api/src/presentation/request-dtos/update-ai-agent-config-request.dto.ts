import { z } from 'zod';

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

export const BusinessVerticalSchema = z.enum(['beauty', 'food', 'retail', 'generic']);

export const CatalogItemSchema = z.object({
  name: z.string().min(1),
  price: z.string().default(''),
  description: z.string().default(''),
});

export const FaqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const BusinessProfileSchema = z.object({
  vertical: BusinessVerticalSchema,
  businessName: z.string().min(1),
  description: z.string().default(''),
  address: z.string().default(''),
  paymentMethods: z.string().default(''),
  catalog: z.array(CatalogItemSchema).default([]),
  faqs: z.array(FaqEntrySchema).default([]),
  extraNotes: z.string().default(''),
});

export const BotBehaviorSchema = z.object({
  language: z.string().min(2).default('es'),
  formality: z.enum(['informal', 'formal']).default('informal'),
  useEmojis: z.boolean().default(true),
  goal: z.string().default(''),
  customInstructions: z.string().default(''),
});

export const UpdateAiAgentConfigRequestSchema = z.object({
  name: z.string().min(1).optional(),
  businessProfile: BusinessProfileSchema.optional(),
  behavior: BotBehaviorSchema.optional(),
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
