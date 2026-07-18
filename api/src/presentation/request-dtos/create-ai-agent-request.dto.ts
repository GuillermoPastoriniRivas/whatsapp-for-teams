import { z } from 'zod';
import { BusinessHoursSchema, BusinessProfileSchema, BotBehaviorSchema } from './update-ai-agent-config-request.dto.js';

export const CreateAiAgentRequestSchema = z.object({
  name: z.string().min(1),
  businessProfile: BusinessProfileSchema,
  behavior: BotBehaviorSchema.optional(),
  handoffRules: z.object({
    keywords: z.array(z.string()).optional(),
    maxConsecutiveFailures: z.number().min(0).optional(),
    onCustomerRequest: z.boolean().optional(),
    urgencyKeywords: z.array(z.string()).optional(),
  }).optional(),
  timezone: z.string().min(1).nullable().optional(),
  businessHours: BusinessHoursSchema.nullable().optional(),
});

export type CreateAiAgentRequestDto = z.infer<typeof CreateAiAgentRequestSchema>;
