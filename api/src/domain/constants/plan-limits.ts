import { PlanTier } from '../enums/plan-tier.enum.js';

export interface PlanLimits {
  maxPhoneNumbers: number;
  maxHumanAgents: number;
  maxAiBots: number;
  maxConversationsPerMonth: number;
  webhooks: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean | 'dedicated';
  priceMonthly: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  [PlanTier.FREE]: {
    maxPhoneNumbers: 1,
    maxHumanAgents: 2,
    maxAiBots: 1,
    maxConversationsPerMonth: 50,
    webhooks: false,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false,
    priceMonthly: 0,
  },
  [PlanTier.PRO]: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: 3,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false,
    priceMonthly: 4900,
  },
  [PlanTier.BUSINESS]: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: -1,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: true,
    whiteLabel: false,
    prioritySupport: true,
    priceMonthly: 9900,
  },
  [PlanTier.AGENCIES]: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: -1,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: true,
    whiteLabel: true,
    prioritySupport: 'dedicated',
    priceMonthly: 29900,
  },
};
