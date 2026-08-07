"use client";

import { useTranslations } from "@/lib/i18n/use-translations";

/**
 * Rubros del perfil de negocio de WhatsApp. Los valores son los de Meta y
 * viajan tal cual; acá solo se traduce cómo se muestran.
 *
 * No confundir con los rubros de los asistentes de IA (`verticals.ts`), que son
 * cuatro y sirven para armar el prompt.
 */
export const BUSINESS_VERTICALS = [
  "UNDEFINED",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
  "NOT_A_BIZ",
  "OTHER",
] as const;

export type MetaBusinessVertical = (typeof BUSINESS_VERTICALS)[number];

/** Valor → etiqueta traducida, en el orden en que se muestran. */
export function useBusinessVerticals(): { value: MetaBusinessVertical; label: string }[] {
  const { t } = useTranslations();
  const labels: Record<MetaBusinessVertical, string> = {
    UNDEFINED: t.admin.verticalUndefined,
    AUTO: t.admin.verticalAuto,
    BEAUTY: t.admin.verticalBeauty,
    APPAREL: t.admin.verticalApparel,
    EDU: t.admin.verticalEdu,
    ENTERTAIN: t.admin.verticalEntertain,
    EVENT_PLAN: t.admin.verticalEventPlan,
    FINANCE: t.admin.verticalFinance,
    GROCERY: t.admin.verticalGrocery,
    GOVT: t.admin.verticalGovt,
    HOTEL: t.admin.verticalHotel,
    HEALTH: t.admin.verticalHealth,
    NONPROFIT: t.admin.verticalNonprofit,
    PROF_SERVICES: t.admin.verticalProfServices,
    RETAIL: t.admin.verticalRetail,
    TRAVEL: t.admin.verticalTravel,
    RESTAURANT: t.admin.verticalRestaurant,
    NOT_A_BIZ: t.admin.verticalNotABiz,
    OTHER: t.admin.verticalOther,
  };
  return BUSINESS_VERTICALS.map((value) => ({ value, label: labels[value] }));
}
