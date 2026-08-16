import { z } from 'zod';

/**
 * Los topes son de Meta y se repiten en el caso de uso: acá cortan la petición
 * malformada, allá se valida el contenido (emojis, campos vacíos) con un
 * mensaje que dice cuál se pasó.
 */
export const ConversationalComponentsRequestSchema = z.object({
  enabled: z.boolean().default(false),
  iceBreakers: z.array(z.string().max(80)).max(4).default([]),
  commands: z
    .array(
      z.object({
        commandName: z.string().min(1).max(32),
        commandDescription: z.string().min(1).max(256),
      }),
    )
    .max(30)
    .default([]),
});

export type ConversationalComponentsRequestDto = z.infer<typeof ConversationalComponentsRequestSchema>;

export const RegisterOnMetaRequestSchema = z.object({
  /** PIN de verificación en dos pasos: exactamente 6 dígitos. */
  pin: z.string().regex(/^\d{6}$/, 'El PIN son 6 dígitos.'),
});

export type RegisterOnMetaRequestDto = z.infer<typeof RegisterOnMetaRequestSchema>;

export const RequestVerificationCodeRequestSchema = z.object({
  method: z.enum(['SMS', 'VOICE']).default('SMS'),
  locale: z.string().min(2).max(10).default('es_ES'),
});

export type RequestVerificationCodeRequestDto = z.infer<typeof RequestVerificationCodeRequestSchema>;

export const VerifyCodeRequestSchema = z.object({
  code: z.string().regex(/^\d{4,8}$/, 'El código son los dígitos que mandó Meta.'),
});

export type VerifyCodeRequestDto = z.infer<typeof VerifyCodeRequestSchema>;

export const BlockUsersRequestSchema = z.object({
  waIds: z.array(z.string().min(6).max(20)).min(1).max(100),
  action: z.enum(['block', 'unblock']),
});

export type BlockUsersRequestDto = z.infer<typeof BlockUsersRequestSchema>;
