"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/stores/locale.store";
import { API_KEY_MODE_LABEL, apiKeyModeCopy } from "@/components/developers/api-key-mode-copy";
import type { ApiKeyMode } from "@/components/developers/types";

interface ApiKeyModeBadgeProps {
  /**
   * Modo de la clave. Si el backend todavía no lo devuelve, no se inventa
   * ninguno: el badge simplemente no se dibuja.
   */
  mode?: ApiKeyMode;
  className?: string;
}

/**
 * Badge LIVE / TEST de una clave de API.
 *
 * El rótulo es técnico (igual en todos los idiomas) y el color dice de un
 * vistazo si la clave manda mensajes de verdad o se queda en el sandbox.
 */
export function ApiKeyModeBadge({ mode, className }: ApiKeyModeBadgeProps) {
  const locale = useLocaleStore((s) => s.locale);

  if (!mode) return null;

  const isTest = mode === "test";
  const copy = apiKeyModeCopy(locale);

  return (
    <Badge
      variant="outline"
      title={isTest ? copy.modeTestHint : copy.modeLiveHint}
      className={cn(
        "font-mono text-[10px] font-semibold tracking-wide",
        isTest
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      {API_KEY_MODE_LABEL[mode]}
    </Badge>
  );
}
