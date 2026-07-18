import { z } from 'zod';

const VariableMappingSchema = z.object({
  component: z.enum(['header', 'body', 'button']),
  index: z.number().int().min(0).max(9).optional(),
  position: z.string().min(1).max(60),
  source: z.enum(['contact_field', 'static']),
  value: z.string().min(1).max(1024),
});

const AudienceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('contactIds'),
    contactIds: z.array(z.string().min(1)).min(1).max(50_000),
  }),
  z.object({
    type: z.literal('filter'),
    search: z.string().max(200).optional(),
  }),
]);

const ThrottleSchema = z.object({
  messagesPerSecond: z.number().int().min(1).max(40).optional(),
  batchSize: z.number().int().min(1).max(200).optional(),
});

export const CreateCampaignRequestSchema = z.object({
  name: z.string().min(1).max(200),
  phoneNumberId: z.string().min(1),
  templateId: z.string().min(1),
  variableMappings: z.array(VariableMappingSchema).max(50).default([]),
  audience: AudienceSchema,
  scheduledAt: z.coerce.date().optional(),
  throttle: ThrottleSchema.optional(),
  replyWindowHours: z.number().int().min(1).max(30 * 24).default(72),
});

export type CreateCampaignRequestDto = z.infer<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateId: z.string().min(1).optional(),
  variableMappings: z.array(VariableMappingSchema).max(50).optional(),
  audience: AudienceSchema.optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  throttle: ThrottleSchema.optional(),
  replyWindowHours: z.number().int().min(1).max(30 * 24).optional(),
});

export type UpdateCampaignRequestDto = z.infer<typeof UpdateCampaignRequestSchema>;
