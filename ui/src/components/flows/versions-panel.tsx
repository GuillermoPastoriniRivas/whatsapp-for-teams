"use client";

// Historial de versiones publicadas. Cada publicación congela un grafo
// inmutable, así que restaurar es traer ese grafo al borrador: no se toca la
// versión activa hasta que se publique de nuevo.

import { useEffect, useState } from "react";
import { History, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner, LoadingState } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { FlowGraph } from "@/types";

interface VersionRow {
  id: string;
  version: number;
  createdAt: string;
}

interface Props {
  flowId: string;
  /** Versión publicada hoy (la que corre en producción) */
  currentVersion: number | null;
  hasUnpublishedChanges: boolean;
  /** Trae un grafo al borrador (canvas). No publica. */
  onRestore: (graph: FlowGraph, label: string) => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function VersionsPanel({ flowId, currentVersion, hasUnpublishedChanges, onRestore, onDiscard, onClose }: Props) {
  const { t } = useTranslations();
  const confirm = useConfirm();
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<VersionRow[]>(`/flows/${flowId}/versions`)
      .then(setVersions)
      .catch(() => setVersions([]));
  }, [flowId]);

  const restore = async (row: VersionRow) => {
    const confirmed = await confirm({
      title: t.flows.restoreVersionConfirm.replace("{version}", String(row.version)),
      confirmLabel: t.flows.restoreVersion,
    });
    if (!confirmed) return;
    setBusyId(row.id);
    try {
      const version = await api.get<{ graph: FlowGraph }>(`/flows/${flowId}/versions/${row.id}`);
      onRestore(version.graph, `v${row.version}`);
      onClose();
    } catch {
      toast.error(t.flows.restoreVersionError);
    } finally {
      setBusyId(null);
    }
  };

  const discard = async () => {
    if (!(await confirm({ title: t.flows.discardChangesConfirm, confirmLabel: t.flows.discardChanges, destructive: true }))) return;
    onDiscard();
    onClose();
  };

  return (
    // Se despliega desde el botón "Versiones" de la barra superior.
    <div className="absolute top-11 right-2 z-(--z-panel) w-80 rounded-xl border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <History className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{t.flows.versions}</span>
        <Button variant="ghost" size="icon-sm" aria-label={t.flows.closePanel} onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {hasUnpublishedChanges && (
        <div className="border-b bg-accent/5 px-3 py-2.5">
          <p className="text-xs font-medium text-accent">{t.flows.unsavedChanges}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.flows.pendingChangesHint
              .replace("{next}", String((currentVersion ?? 0) + 1))
              .replace(
                "{current}",
                currentVersion
                  ? t.flows.pendingChangesCurrent.replace("{version}", String(currentVersion))
                  : t.flows.pendingChangesLast,
              )}
          </p>
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => void discard()}>
            <RotateCcw className="size-3.5" />
            {t.flows.discardChanges}
          </Button>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto">
        {versions === null ? (
          <LoadingState className="py-6" />
        ) : versions.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t.flows.versionsEmpty}</p>
        ) : (
          versions.map((row) => {
            const isCurrent = row.version === currentVersion;
            return (
              <div key={row.id} className={cn("flex items-center gap-2 border-b px-3 py-2 last:border-b-0", isCurrent && "bg-primary/5")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">
                      {t.flows.versionNumber.replace("{version}", String(row.version))}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                        <Check className="size-3" /> {t.flows.versionInUse}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busyId !== null}
                  onClick={() => void restore(row)}
                  aria-label={t.flows.restoreVersion}
                >
                  {busyId === row.id ? <Spinner size="sm" /> : <RotateCcw className="size-3.5" />}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
