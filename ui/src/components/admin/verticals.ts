"use client";

import { useTranslations } from "@/lib/i18n/use-translations";
import type { BusinessVertical } from "@/types";

export interface VerticalCopy {
  value: BusinessVertical;
  label: string;
  /** Ejemplos de rubro, para el alta del asistente. */
  hint: string;
  /** Cómo se llama el catálogo en ese rubro ("Menú y precios"…). */
  catalogLabel: string;
  /** Ejemplo de ítem, para el placeholder del catálogo. */
  itemPlaceholder: string;
}

/**
 * Los cuatro rubros, ya traducidos. Antes la lista, el alta y la ficha del
 * asistente repetían cada una su propia tabla en español fijo.
 */
export function useVerticals(): VerticalCopy[] {
  const { t } = useTranslations();
  return [
    {
      value: "beauty",
      label: t.agents.verticalBeauty,
      hint: t.agents.verticalBeautyHint,
      catalogLabel: t.agents.catalogBeauty,
      itemPlaceholder: t.agents.catalogItemBeauty,
    },
    {
      value: "food",
      label: t.agents.verticalFood,
      hint: t.agents.verticalFoodHint,
      catalogLabel: t.agents.catalogFood,
      itemPlaceholder: t.agents.catalogItemFood,
    },
    {
      value: "retail",
      label: t.agents.verticalRetail,
      hint: t.agents.verticalRetailHint,
      catalogLabel: t.agents.catalogRetail,
      itemPlaceholder: t.agents.catalogItemRetail,
    },
    {
      value: "generic",
      label: t.agents.verticalGeneric,
      hint: t.agents.verticalGenericHint,
      catalogLabel: t.agents.catalogGeneric,
      itemPlaceholder: t.agents.catalogItemGeneric,
    },
  ];
}

/** Solo el nombre del rubro, para listados. */
export function useVerticalLabels(): Record<string, string> {
  const { t } = useTranslations();
  return {
    beauty: t.agents.verticalBeauty,
    food: t.agents.verticalFood,
    retail: t.agents.verticalRetail,
    generic: t.agents.verticalGeneric,
  };
}

/** Idiomas en los que puede contestar el asistente: van en su propia lengua. */
export const AI_LANGUAGES: { value: string; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];
