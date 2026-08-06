"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type ThemePreference } from "@/stores/theme.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

/**
 * Ciclo claro → oscuro → sistema en un solo botón. La landing no tiene el
 * panel de ajustes a mano, así que acá el tema se cambia desde el navbar.
 * Hasta que hidrata muestra el ícono de "sistema": es el default del store y
 * evita que el server pinte un ícono distinto al que corresponde.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslations();
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);

  // El ThemeProvider del layout raíz ya hidrata el store; acá solo se espera.
  const current = hydrated ? theme : "system";
  const Icon = ICONS[current];

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[current])}
      title={t.settings.themeTitle}
      aria-label={t.settings.themeTitle}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
