"use client";

import { AlertCircle, FlaskConical, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/spinner";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import {
  buildNotificationTimeline,
  type NotificationDetail,
  type NotificationTimelinePoint,
  type NotificationTimelineStep,
} from "@/stores/notification.store";
import { NotificationStatusPill } from "./notification-status-pill";
import { formatDateTime } from "./notification-table";

export interface NotificationDetailPanelProps {
  detail: NotificationDetail | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}

/**
 * Detalle de una notificación: datos, recorrido de estados y el aviso de
 * sandbox. Es un panel, no una página: se abre al elegir una fila de la tabla.
 */
export function NotificationDetailPanel({
  detail,
  isLoading,
  error,
  onClose,
  onCancel,
  isCancelling,
}: NotificationDetailPanelProps) {
  const { t } = useTranslations();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {detail ? (detail.templateName ?? detail.id) : t.notifications.logDetailTitle}
          </h2>
          {detail && (
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{detail.id}</p>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t.notifications.logDetailClose} onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">{t.notifications.logDetailEmpty}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <NotificationStatusPill status={detail.status} />
              {detail.sandbox && (
                <Badge variant="outline" className="gap-1">
                  <FlaskConical className="size-3" />
                  {t.notifications.logSandbox}
                </Badge>
              )}
            </div>

            {detail.sandbox && (
              <p className="text-xs text-muted-foreground">{t.notifications.logSandboxHint}</p>
            )}

            <dl className="space-y-2 text-sm">
              <DetailRow label={t.notifications.logColumnTo} value={detail.to ?? "—"} />
              <DetailRow
                label={t.notifications.logColumnTemplate}
                value={detail.templateName ?? "—"}
              />
              <DetailRow
                label={t.notifications.logDetailCreated}
                value={formatDateTime(detail.createdAt)}
              />
              {detail.sendAt && (
                <DetailRow
                  label={t.notifications.logDetailScheduled}
                  value={formatDateTime(detail.sendAt)}
                />
              )}
              {detail.sentAt && (
                <DetailRow label={t.notifications.logDetailSent} value={formatDateTime(detail.sentAt)} />
              )}
              {detail.deliveredAt && (
                <DetailRow
                  label={t.notifications.logDetailDelivered}
                  value={formatDateTime(detail.deliveredAt)}
                />
              )}
              {detail.readAt && (
                <DetailRow label={t.notifications.logDetailRead} value={formatDateTime(detail.readAt)} />
              )}
              {detail.failedAt && (
                <DetailRow
                  label={t.notifications.logDetailFailed}
                  value={formatDateTime(detail.failedAt)}
                />
              )}
            </dl>

            {(detail.failureReason || detail.failureCode) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">{t.notifications.logDetailFailure}</p>
                {detail.failureCode && (
                  <p className="mt-0.5 font-mono text-xs">{detail.failureCode}</p>
                )}
                {detail.failureReason && <p className="mt-1 text-xs">{detail.failureReason}</p>}
              </div>
            )}

            <Timeline points={buildNotificationTimeline(detail)} />

            {Object.keys(detail.metadata ?? {}).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.notifications.logDetailMetadata}
                </h3>
                <dl className="mt-2 space-y-2 text-sm">
                  {Object.entries(detail.metadata ?? {}).map(([key, value]) => (
                    <DetailRow
                      key={key}
                      label={key}
                      value={typeof value === "string" ? value : JSON.stringify(value)}
                    />
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>

      {detail && detail.status === "scheduled" && (
        <footer className="border-t p-4">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={isCancelling}
            onClick={() => onCancel(detail.id)}
          >
            {t.notifications.logCancel}
          </Button>
        </footer>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

/**
 * Recorrido de la notificación: una línea por estado con la fecha en que
 * ocurrió. Los estados que todavía no pasaron no se muestran.
 */
function Timeline({ points }: { points: NotificationTimelinePoint[] }) {
  const { t } = useTranslations();

  if (points.length === 0) return null;

  const label = (step: NotificationTimelineStep | string): string => {
    switch (step) {
      case "created":
        return t.notifications.logTimelineCreated;
      case "scheduled":
        return t.notifications.logTimelineScheduled;
      case "queued":
        return t.notifications.logTimelineQueued;
      case "sent":
        return t.notifications.logTimelineSent;
      case "delivered":
        return t.notifications.logTimelineDelivered;
      case "read":
        return t.notifications.logTimelineRead;
      case "failed":
        return t.notifications.logTimelineFailed;
      case "canceled":
        return t.notifications.logTimelineCanceled;
      default:
        return step;
    }
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t.notifications.logDetailTimeline}
      </h3>
      <ol className="mt-3 space-y-0">
        {points.map((point, index) => (
          <li key={`${point.step}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full",
                  point.at ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
              {index < points.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium">{label(point.step)}</p>
              <p className="text-xs text-muted-foreground">
                {point.at ? formatDateTime(point.at) : t.notifications.logTimelinePending}
              </p>
              {point.detail && <p className="mt-0.5 text-xs text-muted-foreground">{point.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
