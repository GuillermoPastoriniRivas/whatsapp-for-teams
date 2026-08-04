"use client";

import { StatusDot, type StatusTone } from "@/components/ui/status-pill";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

/** Disponibilidad de un agente → tono del sistema de estados. */
const TONES: Record<string, StatusTone> = {
  available: "success",
  busy: "warning",
  offline: "neutral",
};

interface AgentStatusProps {
  status: string;
  className?: string;
  /** Para esconder la etiqueta en pantallas chicas sin tocar el punto. */
  labelClassName?: string;
}

/**
 * Punto de disponibilidad + etiqueta traducida. Lo comparten las dos listas y
 * la ficha del agente, que antes repetían el mismo `statusColors` crudo.
 */
export function AgentStatus({ status, className, labelClassName }: AgentStatusProps) {
  const { t } = useTranslations();
  const label =
    status === "available"
      ? t.common.statusAvailable
      : status === "busy"
        ? t.common.statusBusy
        : t.common.statusOffline;

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <StatusDot tone={TONES[status] ?? "neutral"} />
      <span className={cn("text-xs text-muted-foreground", labelClassName)}>{label}</span>
    </span>
  );
}
