"use client";

import { useEffect } from "react";
import { applyTheme, useThemeStore } from "@/stores/theme.store";

/**
 * Aplica la preferencia de tema al `<html>`. El primer pintado ya lo resolvió
 * el script en línea del layout raíz; esto mantiene la clase al día cuando el
 * usuario cambia el ajuste o cuando el sistema pasa de claro a oscuro.
 */
export function ThemeProvider() {
  const theme = useThemeStore((s) => s.theme);
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
