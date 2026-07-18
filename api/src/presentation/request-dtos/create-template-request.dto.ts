import { z } from 'zod';
import { TemplateCategory } from '../../domain/enums/template-category.enum.js';

const ButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']),
  text: z.string().min(1).max(25),
  url: z.string().url().optional(),
  phone_number: z.string().optional(),
  example: z.array(z.string()).optional(),
});

const ComponentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
  format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
  text: z.string().max(1024).optional(),
  example: z.record(z.string(), z.unknown()).optional(),
  buttons: z.array(ButtonSchema).max(10).optional(),
});

/** Positional placeholders ({{1}}, {{2}}, ...) must be consecutive starting at 1 — Meta rejects gaps. */
function positionalPlaceholdersAreConsecutive(text: string): boolean {
  const positions = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10));
  if (positions.length === 0) return true;
  const unique = [...new Set(positions)].sort((a, b) => a - b);
  return unique[0] === 1 && unique[unique.length - 1] === unique.length;
}

export const CreateTemplateRequestSchema = z
  .object({
    phoneNumberId: z.string().min(1),
    name: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/, 'Template name must contain only lowercase letters, numbers and underscores'),
    language: z.string().min(2).max(10),
    category: z.nativeEnum(TemplateCategory),
    components: z.array(ComponentSchema).min(1).max(4),
  })
  .refine(
    (data) => {
      const body = data.components.find((c) => c.type === 'BODY');
      return !!body?.text;
    },
    { message: 'A BODY component with text is required' },
  )
  .refine(
    (data) => data.components.every((c) => !c.text || positionalPlaceholdersAreConsecutive(c.text)),
    { message: 'Positional placeholders must be consecutive starting at {{1}}' },
  );

export type CreateTemplateRequestDto = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = z
  .object({
    category: z.nativeEnum(TemplateCategory).optional(),
    components: z.array(ComponentSchema).min(1).max(4).optional(),
  })
  .refine((data) => data.category !== undefined || data.components !== undefined, {
    message: 'At least one of category or components is required',
  })
  .refine(
    (data) => !data.components || data.components.every((c) => !c.text || positionalPlaceholdersAreConsecutive(c.text)),
    { message: 'Positional placeholders must be consecutive starting at {{1}}' },
  );

export type UpdateTemplateRequestDto = z.infer<typeof UpdateTemplateRequestSchema>;
