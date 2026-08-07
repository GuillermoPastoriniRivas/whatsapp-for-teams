import { z } from 'zod';

/**
 * Envío suelto de una plantilla a un número cualquiera, sin conversación previa
 * ni campaña: se resuelve (o se crea) el contacto y la conversación a partir
 * del número destino.
 */
export const SendTemplateToNumberRequestSchema = z.object({
  /** Número destino en cualquier formato; se normaliza a dígitos en el caso de uso. */
  to: z.string().trim().min(6).max(30),
  /** Opcional si el tenant tiene un solo número activo. */
  phoneNumberId: z.string().optional(),
  /** Nombre para el contacto si todavía no existe. */
  contactName: z.string().trim().max(120).optional(),
  /** Valores de las variables, con las claves canónicas: `body.1`, `header.link`, `button.0.1`. */
  variables: z.record(z.string(), z.string().max(1024)).default({}),
});

export type SendTemplateToNumberRequestDto = z.infer<typeof SendTemplateToNumberRequestSchema>;
