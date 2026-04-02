"use client";

import { useLocaleStore } from "@/stores/locale.store";
import translations, { type Translations } from "./translations";

export function useTranslations(): {
  t: Translations;
  locale: "es" | "en";
  setLocale: (locale: "es" | "en") => void;
} {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  return { t: translations[locale], locale, setLocale };
}
