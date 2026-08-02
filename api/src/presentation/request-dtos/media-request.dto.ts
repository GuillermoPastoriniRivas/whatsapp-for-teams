import { z } from 'zod';
import { MediaKind } from '../../domain/enums/media-kind.enum.js';
import { MediaSource } from '../../domain/enums/media-source.enum.js';

/** Query params: listas separadas por coma → array validado. */
function csv<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : undefined,
    z.array(schema).optional(),
  );
}

export const ListMediaQuerySchema = z.object({
  /** 'library' = biblioteca curada, 'history' = todo lo que pasó por los chats. */
  scope: z.enum(['library', 'history', 'all']).optional().default('all'),
  kinds: csv(z.nativeEnum(MediaKind)),
  sources: csv(z.nativeEnum(MediaSource)),
  tags: csv(z.string()),
  conversationId: z.string().optional(),
  contactId: z.string().optional(),
  search: z.string().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});

export type ListMediaQueryDto = z.infer<typeof ListMediaQuerySchema>;

export const UpdateMediaRequestSchema = z.object({
  inLibrary: z.boolean().optional(),
  title: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export type UpdateMediaRequestDto = z.infer<typeof UpdateMediaRequestSchema>;

export const UploadMediaRequestSchema = z.object({
  conversationId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  title: z.string().max(200).optional(),
  /** Multipart manda strings: se acepta 'true'. */
  inLibrary: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => value === true || value === 'true'),
  tags: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [])),
});

export type UploadMediaRequestDto = z.infer<typeof UploadMediaRequestSchema>;
