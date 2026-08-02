import type { PlanTier } from "@/types";
import type { Translations } from "@/lib/i18n/translations";

/**
 * Espejo de `api/src/domain/constants/plan-limits.ts`. Si cambia allá, cambia acá:
 * el backend no expone los límites de los planes que el tenant todavía no tiene.
 */
export interface PlanSpec {
  maxPhoneNumbers: number;
  maxHumanAgents: number;
  maxAiBots: number;
  maxActiveFlows: number;
  maxConversationsPerMonth: number;
  webhooks: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean | "dedicated";
  whatsappSupport: boolean;
  /** Centavos de USD por mes. 0 en agencies = a convenir. */
  priceMonthly: number;
  mediaLibrary: boolean;
  /** 0 = passthrough (los archivos viven en Meta), -1 = a convenir. */
  storageBytes: number;
  /** -1 = para siempre, 0 = no guardamos. */
  mediaRetentionDays: number;
  campaignMedia: boolean;
}

const GB = 1024 * 1024 * 1024;

export const PLAN_ORDER: PlanTier[] = ["free", "pro", "business", "agencies"];

export const PLAN_SPECS: Record<PlanTier, PlanSpec> = {
  free: {
    maxPhoneNumbers: 1,
    maxHumanAgents: 2,
    maxAiBots: 1,
    maxActiveFlows: 1,
    maxConversationsPerMonth: 50,
    webhooks: false,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false,
    whatsappSupport: false,
    priceMonthly: 0,
    mediaLibrary: false,
    storageBytes: 0,
    mediaRetentionDays: 0,
    campaignMedia: false,
  },
  pro: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: 3,
    maxActiveFlows: 5,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false,
    whatsappSupport: true,
    priceMonthly: 4900,
    mediaLibrary: true,
    storageBytes: 25 * GB,
    mediaRetentionDays: 365,
    campaignMedia: true,
  },
  business: {
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
  agencies: {
    maxPhoneNumbers: -1,
    maxHumanAgents: -1,
    maxAiBots: -1,
    maxActiveFlows: -1,
    maxConversationsPerMonth: -1,
    webhooks: true,
    apiAccess: true,
    whiteLabel: true,
    prioritySupport: "dedicated",
    whatsappSupport: true,
    priceMonthly: 0,
    mediaLibrary: true,
    storageBytes: -1,
    mediaRetentionDays: -1,
    campaignMedia: true,
  },
};

/** Una fila del detalle del plan. `value` booleano se dibuja como check/cruz. */
export interface PlanFeature {
  label: string;
  value: string | boolean;
  /** Aclaración corta debajo del valor (retención, letra chica). */
  hint?: string;
}

type BillingCopy = Translations["billing"];

const amount = (n: number, unlimited: string) =>
  n === -1 ? unlimited : n.toLocaleString("es-AR");

const storageValue = (spec: PlanSpec, t: BillingCopy) => {
  if (spec.storageBytes === -1) return t.storageCustom;
  if (spec.storageBytes === 0) return false;
  return `${Math.round(spec.storageBytes / GB)} GB`;
};

const storageHint = (spec: PlanSpec, t: BillingCopy) => {
  if (spec.storageBytes === 0) return t.storagePassthrough;
  if (spec.mediaRetentionDays === -1) return t.retentionForever;
  if (spec.mediaRetentionDays === 365) return t.retentionOneYear;
  return undefined;
};

const supportValue = (spec: PlanSpec, t: BillingCopy) => {
  if (spec.prioritySupport === "dedicated") return t.dedicatedSupport;
  if (spec.prioritySupport) return t.prioritySupport;
  if (spec.whatsappSupport) return t.supportWhatsapp;
  return t.emailSupport;
};

/** Detalle completo de lo que incluye un plan, listo para renderizar. */
export function planFeatures(tier: PlanTier, t: BillingCopy): PlanFeature[] {
  const spec = PLAN_SPECS[tier];
  return [
    { label: t.phoneNumbers, value: amount(spec.maxPhoneNumbers, t.unlimited) },
    { label: t.humanAgents, value: amount(spec.maxHumanAgents, t.unlimited) },
    { label: t.aiBots, value: amount(spec.maxAiBots, t.unlimited) },
    { label: t.activeFlows, value: amount(spec.maxActiveFlows, t.unlimited) },
    {
      label: t.conversations,
      value: amount(spec.maxConversationsPerMonth, t.unlimited),
    },
    {
      label: t.mediaStorage,
      value: storageValue(spec, t),
      hint: storageHint(spec, t),
    },
    { label: t.campaignMedia, value: spec.campaignMedia },
    { label: t.webhooks, value: spec.webhooks },
    { label: t.apiAccess, value: spec.apiAccess },
    { label: t.whiteLabel, value: spec.whiteLabel },
    { label: t.support, value: supportValue(spec, t) },
  ];
}

/** Precio mensual formateado: "Gratis", "$49", o "A medida" para agencies. */
export function planPrice(tier: PlanTier, t: BillingCopy): string {
  if (tier === "agencies") return t.customPrice;
  const spec = PLAN_SPECS[tier];
  if (spec.priceMonthly === 0) return t.freePrice;
  return `$${spec.priceMonthly / 100}`;
}
