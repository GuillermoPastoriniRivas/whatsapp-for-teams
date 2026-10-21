"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RightPanel } from "@/components/layout/right-panel";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { useNotificationStore } from "@/stores/notification.store";
import type { MessageTemplate, PaginatedResponse } from "@/types";
import { NotificationStatusFilter, NotificationFilters } from "./_components/notification-filters";
import { NotificationTable } from "./_components/notification-table";
import { NotificationDetailPanel } from "./_components/notification-detail";

/**
 * Historial de las notificaciones que la API envió.
 *
 * Los datos salen del backend con sesión JWT: `GET /notifications` para la
 * lista y `GET /notifications/:id` para el detalle. No hay datos de ejemplo:
 * si no hay notificaciones, se dice que no hay.
 */
export default function NotificationsPage() {
  const { t } = useTranslations();
  const confirm = useConfirm();

  const {
    notifications,
    meta,
    statusFilter,
    templateIdFilter,
    from,
    to,
    isLoading,
    error,
    fetch,
    setStatusFilter,
    setTemplateIdFilter,
    setFrom,
    setTo,
    selectedId,
    detail,
    isDetailLoading,
    detailError,
    isCancelling,
    select,
    cancel,
  } = useNotificationStore();

  // Opciones del filtro de plantilla. Las notificaciones traen el nombre de
  // la plantilla, pero el filtro va por id, así que se listan las plantillas
  // de la cuenta.
  const [templateOptions, setTemplateOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    api
      .get<PaginatedResponse<MessageTemplate>>("/templates?page=1&limit=100")
      .then((res) =>
        setTemplateOptions(
          (res.data ?? [])
            .filter((tpl) => !!tpl.id)
            .map((tpl) => ({ id: tpl.id, name: tpl.name }))
        )
      )
      .catch(() => {
        // El filtro de plantilla es opcional: si no se pueden listar las
        // plantillas, el resto de la pantalla sigue funcionando.
        setTemplateOptions([]);
      });
  }, []);

  const hasFilters = useMemo(
    () => !!statusFilter || !!templateIdFilter || !!from || !!to,
    [statusFilter, templateIdFilter, from, to]
  );

  const closeDetail = () => {
    select(null);
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: t.notifications.logCancelConfirm,
      confirmLabel: t.notifications.logActionCancel,
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await cancel(id);
      toast.success(t.notifications.logCancelSuccess);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.notifications.logCancelError);
    }
  };

  return (
    <div className="flex h-full">
      <PageShell className="min-w-0 flex-1">
        <PageHeader
          title={t.notifications.logTitle}
          subtitle={t.notifications.logSubtitle}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetch(meta.page)}
              disabled={isLoading}
              aria-label={t.notifications.logRefresh}
            >
              <RefreshCw className="size-4" />
              <span className="hidden sm:inline">{t.notifications.logRefresh}</span>
            </Button>
          }
        >
          <NotificationStatusFilter value={statusFilter} onChange={setStatusFilter} />
        </PageHeader>

        <PageContent className="space-y-4">
          <NotificationFilters
            templateId={templateIdFilter}
            onTemplateChange={setTemplateIdFilter}
            templateOptions={templateOptions}
            from={from}
            onFromChange={setFrom}
            to={to}
            onToChange={setTo}
          />

          {error && (
            <InlineNotice variant="error">
              <p className="font-medium">{t.notifications.logErrorTitle}</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </InlineNotice>
          )}

          {isLoading && notifications.length === 0 ? (
            <LoadingState />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={hasFilters ? t.notifications.logNoResults : t.notifications.logEmptyTitle}
              description={t.notifications.logEmptyBody}
            />
          ) : (
            <>
              <NotificationTable
                notifications={notifications}
                selectedId={selectedId}
                onSelect={(id) => select(id)}
                onCancel={handleCancel}
                isCancelling={isCancelling}
              />
              <Pagination page={meta.page} pages={meta.pages} onPageChange={(page) => fetch(page)} />
            </>
          )}
        </PageContent>
      </PageShell>

      <RightPanel open={!!selectedId} onClose={closeDetail} label={t.notifications.logDetailTitle}>
        <NotificationDetailPanel
          detail={detail}
          isLoading={isDetailLoading}
          error={detailError}
          onClose={closeDetail}
          onCancel={handleCancel}
          isCancelling={isCancelling}
        />
      </RightPanel>
    </div>
  );
}
