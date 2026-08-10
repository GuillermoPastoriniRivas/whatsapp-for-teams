import { z } from 'zod';

const base = {
  name: z.string().min(1).max(80),
  phone: z.string().min(6).max(30),
  services: z.array(z.string().min(1).max(40)).max(30),
  active: z.boolean(),
  /**
   * Que el proveedor aceptó recibir estos avisos. Sin esto no se puede activar:
   * le escribimos primero, así que el permiso es obligatorio.
   */
  optIn: z.boolean(),
  optInNote: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
};

export const CreateServiceProviderRequestSchema = z.object(base);
export type CreateServiceProviderRequestDto = z.infer<typeof CreateServiceProviderRequestSchema>;

export const UpdateServiceProviderRequestSchema = z.object({
  name: base.name.optional(),
  phone: base.phone.optional(),
  services: base.services.optional(),
  active: base.active.optional(),
  optIn: base.optIn.optional(),
  optInNote: base.optInNote,
  notes: base.notes,
});
export type UpdateServiceProviderRequestDto = z.infer<typeof UpdateServiceProviderRequestSchema>;
