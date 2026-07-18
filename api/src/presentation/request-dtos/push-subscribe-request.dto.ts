import { z } from 'zod';

export const PushSubscribeRequestSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscribeRequestDto = z.infer<typeof PushSubscribeRequestSchema>;

export const PushUnsubscribeRequestSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export type PushUnsubscribeRequestDto = z.infer<typeof PushUnsubscribeRequestSchema>;
