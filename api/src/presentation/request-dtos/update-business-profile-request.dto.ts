import { z } from 'zod';
import { BUSINESS_VERTICALS } from '../../domain/enums/business-vertical.enum.js';
import { BUSINESS_PROFILE_LIMITS } from '../../domain/entities/whatsapp-business-profile.entity.js';

/**
 * Los topes son los de Meta. Un campo ausente no se toca; una cadena vacía lo
 * borra, que es como se limpia un dato del perfil.
 */
export const UpdateBusinessProfileRequestSchema = z.object({
  about: z.string().max(BUSINESS_PROFILE_LIMITS.about).nullish(),
  address: z.string().max(BUSINESS_PROFILE_LIMITS.address).nullish(),
  description: z.string().max(BUSINESS_PROFILE_LIMITS.description).nullish(),
  email: z.string().max(BUSINESS_PROFILE_LIMITS.email).nullish(),
  vertical: z.enum(BUSINESS_VERTICALS).nullish(),
  websites: z
    .array(z.string().max(BUSINESS_PROFILE_LIMITS.websiteUrl))
    .max(BUSINESS_PROFILE_LIMITS.websites)
    .optional(),
});

export type UpdateBusinessProfileRequestDto = z.infer<typeof UpdateBusinessProfileRequestSchema>;
