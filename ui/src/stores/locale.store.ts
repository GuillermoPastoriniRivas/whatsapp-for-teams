"use client";

import { create } from "zustand";

export type Locale = "es" | "en";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LOCALE_KEY = "asis-locale";

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: (typeof window !== "undefined"
    ? (localStorage.getItem(LOCALE_KEY) as Locale) || "es"
    : "es"),
  setLocale: (locale) => {
    localStorage.setItem(LOCALE_KEY, locale);
    set({ locale });
  },
}));
