import { z } from 'zod';
import { PhoneNumberPlugin } from '../../domain/enums/phone-number-plugin.enum.js';
import { PhoneNumberStatus } from '../../domain/enums/phone-number-status.enum.js';

export const UpdatePhoneNumberRequestSchema = z.object({
  label: z.string().min(1).optional(),
  status: z.nativeEnum(PhoneNumberStatus).optional(),
  webhookSecret: z.string().min(1).optional(),
  providerConfig: z.record(z.string(), z.string()).optional(),
  wabaId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
  displayPhone: z.string().min(1).optional(),
  plugins: z.array(z.nativeEnum(PhoneNumberPlugin)).optional(),
});

export type UpdatePhoneNumberRequestDto = z.infer<typeof UpdatePhoneNumberRequestSchema>;
