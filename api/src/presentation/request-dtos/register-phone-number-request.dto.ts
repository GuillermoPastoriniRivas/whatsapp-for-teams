import { z } from 'zod';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

export const RegisterPhoneNumberRequestSchema = z.object({
  provider: z.nativeEnum(MessagingProvider),
  providerConfig: z.record(z.string().max(100), z.string().max(500)),
  wabaId: z.string().min(1).max(100),
  phoneNumberId: z.string().min(1).max(100),
  displayPhone: z.string().min(1).max(30),
  label: z.string().min(1).max(100),
  webhookSecret: z.string().min(1).max(500),
});

export type RegisterPhoneNumberRequestDto = z.infer<typeof RegisterPhoneNumberRequestSchema>;
