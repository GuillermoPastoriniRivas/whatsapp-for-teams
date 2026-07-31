import { z } from 'zod';
import { DeveloperEventType, SUBSCRIBABLE_DEVELOPER_EVENTS } from '../../domain/enums/developer-event-type.enum.js';

const subscribableEvent = z
  .nativeEnum(DeveloperEventType)
  .refine((e) => SUBSCRIBABLE_DEVELOPER_EVENTS.includes(e), { message: 'Event not subscribable' });

export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateApiKeyRequestDto = z.infer<typeof CreateApiKeyRequestSchema>;

export const CreateWebhookRequestSchema = z.object({
  url: z.string().url().max(2000),
  description: z.string().max(200).nullish(),
  events: z.array(subscribableEvent).min(1),
});
export type CreateWebhookRequestDto = z.infer<typeof CreateWebhookRequestSchema>;

export const UpdateWebhookRequestSchema = z.object({
  url: z.string().url().max(2000).optional(),
  description: z.string().max(200).nullish(),
  events: z.array(subscribableEvent).min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdateWebhookRequestDto = z.infer<typeof UpdateWebhookRequestSchema>;
