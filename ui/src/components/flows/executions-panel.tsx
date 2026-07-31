"use client";

// Pestaña Ejecuciones del builder: tabla paginada + drawer con el recorrido
// paso a paso y las variables capturadas.

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, X, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { NODE_BY_TYPE } from "@/lib/flows/node-catalog";
import { cn } from "@/lib/utils";
import type { FlowExecution, FlowExecutionSummaryRow, PaginatedResponse } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  running: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  waiting: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  running: "En curso",
  waiting: "Esperando",
  completed: "Completada",
  failed: "Con error",
  cancelled: "Detenida",
};

export function ExecutionsPanel({ flowId }: { flowId: string }) {
  const { t } = useTranslations();
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
    <div className="flex-1 min-h-0 flex">
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">
            <p>{t.flows.executionsEmpty}</p>
            <p className="text-xs mt-1">{t.flows.testHint}</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-w-3xl mx-auto">
            {rows.map(({ execution, contactName }) => (
              <button
                key={execution.id}
                className="w-full border rounded-lg p-3 flex items-center gap-3 text-left hover:bg-muted/40"
                onClick={() => setSelected(execution)}
              >
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{contactName ?? "Contacto"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(execution.startedAt).toLocaleString()} · {execution.stepCount} pasos
                    {execution.endReason ? ` · ${execution.endReason}` : ""}
                  </span>
                </span>
                <Badge variant="secondary" className={STATUS_STYLES[execution.status] ?? ""}>
                  {STATUS_LABELS[execution.status] ?? execution.status}
                </Badge>
              </button>
            ))}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground">{page} / {pages}</span>
                <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <ExecutionDetail
          execution={selected}
          onClose={() => setSelected(null)}
          onCancelled={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ExecutionDetail({ execution, onClose, onCancelled }: { execution: FlowExecution; onClose: () => void; onCancelled: () => void }) {
  const { t } = useTranslations();
  const isLive = execution.status === "running" || execution.status === "waiting";
  const variables = (execution.variables?.vars as Record<string, unknown>) ?? {};

  return (
    <div className="w-96 shrink-0 border-l bg-background overflow-y-auto">
      <div className="flex items-center justify-between border-b px-3 py-2.5 sticky top-0 bg-background">
        <span className="text-sm font-medium">Ejecución</span>
        <div className="flex items-center gap-1">
          {isLive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                if (window.confirm(t.flows.stopFlowConfirm)) {
                  void api.post(`/flow-executions/${execution.id}/cancel`).then(onCancelled);
                }
              }}
            >
              <StopCircle className="size-4 mr-1" />
              {t.flows.stopFlow}
            </Button>
          )}
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {execution.error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
            {execution.error.message}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Recorrido</p>
          <div className="space-y-1">
            {execution.steps.map((step, index) => {
              const def = NODE_BY_TYPE.get(step.type);
              return (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <span
                    className={cn(
                      "mt-1 size-1.5 rounded-full shrink-0",
                      step.status === "ok" ? "bg-primary" : step.status === "skipped" ? "bg-muted-foreground" : "bg-destructive",
                    )}
                  />
                  <div className="min-w-0">
                    <span className="font-medium">{def?.label ?? step.type}</span>
                    {step.handle && <span className="text-muted-foreground"> → {step.handle}</span>}
                    {step.note && <p className="text-muted-foreground truncate">{step.note}</p>}
                  </div>
                </div>
              );
            })}
            {execution.steps.length === 0 && <p className="text-xs text-muted-foreground">Sin pasos todavía.</p>}
          </div>
        </div>

        {Object.keys(variables).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Variables capturadas</p>
            <div className="space-y-1">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="text-xs flex gap-2">
                  <code className="text-primary shrink-0">{key}</code>
                  <span className="text-muted-foreground truncate">
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
