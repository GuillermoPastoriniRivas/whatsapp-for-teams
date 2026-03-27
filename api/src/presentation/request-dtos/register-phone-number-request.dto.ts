import { z } from 'zod';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

export const RegisterPhoneNumberRequestSchema = z.object({
  provider: z.nativeEnum(MessagingProvider),
  providerConfig: z.record(z.string(), z.string()),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  displayPhone: z.string().min(1),
  label: z.string().min(1),
  webhookSecret: z.string().min(1),
});

export type RegisterPhoneNumberRequestDto = z.infer<typeof RegisterPhoneNumberRequestSchema>;
