import type { BusinessHours, BusinessProfile } from '../value-objects/business-profile.js';
import { EMPTY_BUSINESS_PROFILE } from '../value-objects/business-profile.js';
import type { AiRateLimits } from '../value-objects/ai-persona.js';
import { DEFAULT_AI_RATE_LIMITS } from '../value-objects/ai-persona.js';

export class Tenant {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly createdAt: Date,
    public readonly isDemo: boolean = false,
    /**
     * Los datos del negocio que usan los nodos de IA para armar su prompt.
     * Viven acá, no en cada bot: el negocio es uno solo.
     */
    public readonly businessProfile: BusinessProfile = EMPTY_BUSINESS_PROFILE,
    /** IANA; con qué reloj se leen los horarios. Null = el del servidor. */
    public readonly timezone: string | null = null,
    public readonly businessHours: BusinessHours | null = null,
    /**
     * Tope diario de gasto en IA. Vive en la cuenta y no en el nodo: es un
     * guardarraíl de plata, y tenerlo por nodo hacía que el tope real fuera
     * la suma de todos los nodos, o sea ninguno.
     */
    public readonly aiRateLimits: AiRateLimits = DEFAULT_AI_RATE_LIMITS,
  ) {}
}
