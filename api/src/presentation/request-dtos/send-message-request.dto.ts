import { z } from 'zod';
import { MessageType } from '../../domain/enums/message-type.enum.js';

export const SendMessageRequestSchema = z
  .object({
    // Con adjunto el texto es opcional: pasa a ser el caption.
    body: z.string().max(4096).optional().default(''),
    messageType: z.nativeEnum(MessageType).optional(),
    mediaAssetId: z.string().optional(),
  })
  .refine((value) => value.body.trim().length > 0 || !!value.mediaAssetId, {
    message: 'Escribí un mensaje o adjuntá un archivo.',
    path: ['body'],
  });

export type SendMessageRequestDto = z.infer<typeof SendMessageRequestSchema>;
