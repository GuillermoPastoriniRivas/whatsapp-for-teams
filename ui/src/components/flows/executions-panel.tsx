"use client";

// Pestaña Ejecuciones del builder: tabla paginada + panel con el recorrido
// paso a paso y las variables capturadas.

import { useCallback, useEffect, useState } from "react";
import { StopCircle, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { RightPanel } from "@/components/layout/right-panel";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import { NODE_BY_TYPE } from "@/lib/flows/node-catalog";
import { cn } from "@/lib/utils";
import type { FlowExecution, FlowExecutionSummaryRow, PaginatedResponse } from "@/types";

const STATUS_TONES: Record<string, StatusTone> = {
  running: "info",
  waiting: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
};

function useExecutionStatusLabels(): Record<string, string> {
  const { t } = useTranslations();
  return {
    running: t.flows.execStatusRunning,
    waiting: t.flows.execStatusWaiting,
    completed: t.flows.execStatusCompleted,
    failed: t.flows.execStatusFailed,
    cancelled: t.flows.execStatusCancelled,
  };
}

export function ExecutionsPanel({ flowId }: { flowId: string }) {
  const { t } = useTranslations();
  const statusLabels = useExecutionStatusLabels();
  const [rows, setRows] = useState<FlowExecutionSummaryRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FlowExecution | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<PaginatedResponse<FlowExecutionSummaryRow>>(
        `/flows/${flowId}/executions?page=${page}&limit=20`,
      );
      setRows(result.data);
      setPages(result.meta.pages || 1);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [flowId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    // `relative`: en mobile el RightPanel se monta como capa a pantalla completa
    // sobre este contenedor.
    <div className="relative flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState icon={Workflow} title={t.flows.executionsEmpty} description={t.flows.testHint} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-1.5">
            {rows.map(({ execution, contactName }) => (
              <button
                key={execution.id}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
                onClick={() => setSelected(execution)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{contactName ?? t.flows.executionContact}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(execution.startedAt).toLocaleString()} · {execution.stepCount} {t.flows.executionSteps}
                    {execution.endReason ? ` · ${execution.endReason}` : ""}
                  </span>
                </span>
                <StatusPill tone={STATUS_TONES[execution.status] ?? "neutral"}>
                  {statusLabels[execution.status] ?? execution.status}
                </StatusPill>
              </button>
            ))}
            <Pagination page={page} pages={pages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <RightPanel open={selected !== null} onClose={() => setSelected(null)} label={t.flows.execution}>
        {selected && (
          <ExecutionDetail
            key={selected.id}
            execution={selected}
            onCancelled={() => {
              setSelected(null);
              void load();
            }}
          />
        )}
      </RightPanel>
    </div>
  );
}

function ExecutionDetail({ execution, onCancelled }: { execution: FlowExecution; onCancelled: () => void }) {
  const { t } = useTranslations();
  const confirm = useConfirm();
  const isLive = execution.status === "running" || execution.status === "waiting";
  const variables = (execution.variables?.vars as Record<string, unknown>) ?? {};

  const stop = async () => {
    if (!(await confirm({ title: t.flows.stopFlowConfirm, confirmLabel: t.flows.stopFlow, destructive: true }))) return;
    try {
      await api.post(`/flow-executions/${execution.id}/cancel`);
      onCancelled();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.flows.stopFlowError);
    }
  };

  return (
    <div>
      <div className="sticky top-0 flex items-center justify-between gap-2 border-b bg-background px-3 py-2.5">
        <span className="text-sm font-medium">{t.flows.execution}</span>
        {isLive && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void stop()}>
            <StopCircle className="size-4" />
            {t.flows.stopFlow}
          </Button>
        )}
      </div>

      <div className="space-y-4 p-3">
        {execution.error && <InlineNotice variant="error">{execution.error.message}</InlineNotice>}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.flows.executionPath}</p>
          <div className="space-y-1">
            {execution.steps.map((step, index) => {
              const def = NODE_BY_TYPE.get(step.type);
              return (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <span
                    className={cn(
                      "mt-1 size-1.5 shrink-0 rounded-full",
                      step.status === "ok" ? "bg-primary" : step.status === "skipped" ? "bg-muted-foreground" : "bg-destructive",
                    )}
                  />
                  <div className="min-w-0">
                    <span className="font-medium">{def?.label ?? step.type}</span>
                    {step.handle && <span className="text-muted-foreground"> → {step.handle}</span>}
                    {step.note && <p className="truncate text-muted-foreground">{step.note}</p>}
                  </div>
                </div>
              );
            })}
            {execution.steps.length === 0 && (
              <p className="text-xs text-muted-foreground">{t.flows.executionNoSteps}</p>
            )}
          </div>
        </div>

        {Object.keys(variables).length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.flows.executionVariables}</p>
            <div className="space-y-1">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <code className="shrink-0 text-primary">{key}</code>
                  <span className="truncate text-muted-foreground">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
