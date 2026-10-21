"use client";

import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { NotificationStatus } from "@/stores/notification.store";

/**
 * Tonos de la píldora de estado. El color no lo decide cada pantalla: acá se
 * mapea el estado a una semántica (`success` = salió, `danger` = falló) y el
 * `StatusPill` resuelve el color.
 */
export const NOTIFICATION_STATUS_TONES: Record<NotificationStatus, StatusTone> = {
  scheduled: "scheduled",
  queued: "info",
  sent: "primary",
  delivered: "success",
  read: "success",
  failed: "danger",
  canceled: "neutral",
};

export function useNotificationStatusLabels(): Record<NotificationStatus, string> {
  const { t } = useTranslations();
  return {
    scheduled: t.notifications.logStatusScheduled,
    queued: t.notifications.logStatusQueued,
    sent: t.notifications.logStatusSent,
    delivered: t.notifications.logStatusDelivered,
    read: t.notifications.logStatusRead,
    failed: t.notifications.logStatusFailed,
    canceled: t.notifications.logStatusCanceled,
  };
}

export function NotificationStatusPill({
  status,
  className,
}: {
  status: NotificationStatus;
  className?: string;
}) {
  const labels = useNotificationStatusLabels();
  return (
    <StatusPill
      tone={NOTIFICATION_STATUS_TONES[status] ?? "neutral"}
      pulse={status === "queued"}
      className={className}
    >
      {labels[status] ?? status}
    </StatusPill>
  );
}
