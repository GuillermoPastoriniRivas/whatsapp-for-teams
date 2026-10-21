"use client";

import { Eye, FlaskConical, MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { NotificationListItem } from "@/stores/notification.store";
import { NotificationStatusPill } from "./notification-status-pill";

export interface NotificationTableProps {
  notifications: NotificationListItem[];
  /** Id de la fila abierta, para marcarla. */
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Cancelar una notificación programada. */
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}

/**
 * Listado de notificaciones enviadas por la API.
 *
 * En escritorio es tabla y en mobile son tarjetas, como en el resto de la
 * app: una tabla de cinco columnas no entra en un teléfono.
 */
export function NotificationTable({
  notifications,
  selectedId,
  onSelect,
  onCancel,
  isCancelling = false,
}: NotificationTableProps) {
  const { t } = useTranslations();

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.notifications.logColumnTo}</TableHead>
              <TableHead>{t.notifications.logColumnTemplate}</TableHead>
              <TableHead>{t.notifications.logColumnStatus}</TableHead>
              <TableHead>{t.notifications.logColumnCreatedAt}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((notification) => (
              <TableRow
                key={notification.id}
                data-state={notification.id === selectedId ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect(notification.id)}
              >
                <TableCell className="font-medium">
                  {notification.to ?? "—"}
                  {notification.sandbox && (
                    <Badge variant="outline" className="ml-2 gap-1">
                      <FlaskConical className="size-3" />
                      {t.notifications.logSandbox}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {notification.templateName ?? "—"}
                </TableCell>
                <TableCell>
                  <NotificationStatusPill status={notification.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(notification.createdAt)}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <NotificationActions
                    notification={notification}
                    onSelect={onSelect}
                    onCancel={onCancel}
                    isCancelling={isCancelling}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelect(notification.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{notification.to ?? "—"}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {notification.templateName ?? "—"}
                </p>
              </button>
              <NotificationActions
                notification={notification}
                onSelect={onSelect}
                onCancel={onCancel}
                isCancelling={isCancelling}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <NotificationStatusPill status={notification.status} />
              <span className="text-xs text-muted-foreground">
                {formatDateTime(notification.createdAt)}
              </span>
              {notification.sandbox && (
                <Badge variant="outline" className="gap-1">
                  <FlaskConical className="size-3" />
                  {t.notifications.logSandbox}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function NotificationActions({
  notification,
  onSelect,
  onCancel,
  isCancelling,
}: {
  notification: NotificationListItem;
  onSelect: (id: string) => void;
  onCancel?: (id: string) => void;
  isCancelling: boolean;
}) {
  const { t } = useTranslations();

  // Solo se puede cancelar lo que todavía no salió.
  const canCancel = notification.status === "scheduled" && !!onCancel;

  if (!canCancel) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.notifications.logActionView}
        onClick={() => onSelect(notification.id)}
      >
        <Eye className="size-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={isCancelling}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">{t.notifications.logColumnActions}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onSelect(notification.id)}>
          {t.notifications.logActionView}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onCancel?.(notification.id)}
        >
          {t.notifications.logActionCancel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fecha en el formato local del navegador; `—` si no hay fecha. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}
