import { z } from 'zod';
import { AiProvider } from '../../domain/enums/ai-provider.enum.js';

export const CreateAiAgentRequestSchema = z.object({
  name: z.string().min(1),
  provider: z.nativeEnum(AiProvider),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  systemPrompt: z.string().optional(),
  knowledgeBase: z.string().optional(),
  persona: z.object({
    role: z.string().min(1),
    tone: z.string().min(1),
    language: z.string().min(1),
    instructions: z.string().default(''),
  }),
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
});

export type CreateAiAgentRequestDto = z.infer<typeof CreateAiAgentRequestSchema>;
