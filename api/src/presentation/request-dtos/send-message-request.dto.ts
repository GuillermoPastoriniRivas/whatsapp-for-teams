import { z } from 'zod';
import { MessageType } from '../../domain/enums/message-type.enum.js';

export const SendMessageRequestSchema = z.object({
  body: z.string().min(1).max(4096),
  messageType: z.nativeEnum(MessageType).optional(),
});

export type SendMessageRequestDto = z.infer<typeof SendMessageRequestSchema>;
