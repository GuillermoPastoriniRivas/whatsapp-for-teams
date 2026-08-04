"use client";

import { create } from "zustand";

/** El tema es una preferencia por dispositivo, igual que el zoom. */
const THEME_KEY = "asis-theme";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_OPTIONS: ThemePreference[] = ["light", "dark", "system"];

interface ThemeState {
  theme: ThemePreference;
  hydrated: boolean;
  /** Lee el valor guardado en el cliente, después de montar, para no romper la hidratación. */
  hydrate: () => void;
  setTheme: (theme: ThemePreference) => void;
}

function isTheme(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Traduce la preferencia a la clase que espera `globals.css`. */
export function applyTheme(theme: ThemePreference): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "system",
  hydrated: false,
  hydrate: () => {
    const stored = localStorage.getItem(THEME_KEY);
    set({ theme: isTheme(stored) ? stored : "system", hydrated: true });
  },
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
}));
