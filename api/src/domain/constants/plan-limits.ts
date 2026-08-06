import { PlanTier } from '../enums/plan-tier.enum.js';

export interface PlanLimits {
  maxPhoneNumbers: number;
  maxHumanAgents: number;
  maxAiBots: number;
  maxActiveFlows: number;
  maxConversationsPerMonth: number;
  webhooks: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean | 'dedicated';
  whatsappSupport: boolean;
  priceMonthly: number;
  /**
   * Media library. En `false` el tenant opera en passthrough: no guardamos un
   * solo byte, los archivos viven en Meta y se pierden a los 30 días.
   */
  mediaLibrary: boolean;
  /** Bytes de storage incluidos. 0 = passthrough, -1 = a convenir. */
  storageBytes: number;
  /** Días que retenemos un archivo. -1 = para siempre, 0 = no guardamos. */
  mediaRetentionDays: number;
  /** Adjuntar media a campañas (necesita bytes propios para poder reenviar). */
  campaignMedia: boolean;
}

const GB = 1024 * 1024 * 1024;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  [PlanTier.FREE]: {
    maxPhoneNumbers: 1,
    maxHumanAgents: 2,
    maxAiBots: 1,
    maxActiveFlows: 1,
    maxConversationsPerMonth: 50,
    webhooks: false,
    // La API es la puerta de entrada de los devs: se prueba gratis o no se
    // prueba. El techo real del plan free lo pone maxConversationsPerMonth.
    apiAccess: true,
    whiteLabel: false,
    prioritySupport: false,
    whatsappSupport: false,
    priceMonthly: 0,
    mediaLibrary: false,
    storageBytes: 0,
    mediaRetentionDays: 0,
    campaignMedia: false,
  },
  [PlanTier.PRO]: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: 3,
    maxActiveFlows: 5,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: true,
    whiteLabel: false,
    prioritySupport: false,
    whatsappSupport: true,
    priceMonthly: 4900,
    mediaLibrary: true,
    storageBytes: 25 * GB,
    mediaRetentionDays: 365,
    campaignMedia: true,
  },
  [PlanTier.BUSINESS]: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: -1,
    maxActiveFlows: 20,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: true,
    whiteLabel: false,
    prioritySupport: true,
    whatsappSupport: true,
    priceMonthly: 9900,
    mediaLibrary: true,
    storageBytes: 250 * GB,
    mediaRetentionDays: -1,
    campaignMedia: true,
  },
  [PlanTier.AGENCIES]: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: -1,
    maxActiveFlows: -1,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: true,
    whiteLabel: true,
    prioritySupport: 'dedicated',
    whatsappSupport: true,
    priceMonthly: 0,
    mediaLibrary: true,
    storageBytes: -1,
    mediaRetentionDays: -1,
    campaignMedia: true,
  },
};
