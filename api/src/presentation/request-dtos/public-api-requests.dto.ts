import { z } from 'zod';

export const PublicSendMessageRequestSchema = z
  .object({
    /** Número destino en formato internacional (con o sin +) */
    to: z.string().min(8).max(20),
    phoneNumberId: z.string().optional(),
    contactName: z.string().max(120).optional(),
    body: z.string().min(1).max(4096).optional(),
    templateId: z.string().optional(),
    variables: z.record(z.string(), z.string()).optional(),
  })
  .refine((data) => data.body || data.templateId, {
    message: 'Provide either `body` or `templateId`',
  });
export type PublicSendMessageRequestDto = z.infer<typeof PublicSendMessageRequestSchema>;

export const PublicConversationMessageRequestSchema = z.object({
  body: z.string().min(1).max(4096),
});
export type PublicConversationMessageRequestDto = z.infer<typeof PublicConversationMessageRequestSchema>;

export const PublicCreateContactRequestSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().max(120).optional(),
});
export type PublicCreateContactRequestDto = z.infer<typeof PublicCreateContactRequestSchema>;
