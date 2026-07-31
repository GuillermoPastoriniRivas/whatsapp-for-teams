"use client";

// Historial de versiones publicadas. Cada publicación congela un grafo
// inmutable, así que restaurar es traer ese grafo al borrador: no se toca la
// versión activa hasta que se publique de nuevo.

import { useEffect, useState } from "react";
import { History, Loader2, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
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
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<VersionRow[]>(`/flows/${flowId}/versions`)
      .then(setVersions)
      .catch(() => setVersions([]));
  }, [flowId]);

  const restore = async (row: VersionRow) => {
    if (!window.confirm(`¿Traer la versión ${row.version} al editor? Reemplaza lo que tenés en pantalla; se publica recién cuando toques Publicar.`)) return;
    setBusyId(row.id);
    try {
      const version = await api.get<{ graph: FlowGraph }>(`/flows/${flowId}/versions/${row.id}`);
      onRestore(version.graph, `v${row.version}`);
      onClose();
    } catch {
      window.alert("No se pudo traer esa versión");
    } finally {
      setBusyId(null);
    }
  };

  return (
    // Se despliega desde el botón "Versiones" de la barra superior.
    <div className="absolute top-11 right-2 z-30 w-80 rounded-lg border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <History className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">Versiones</span>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>

      {hasUnpublishedChanges && (
        <div className="border-b px-3 py-2.5 bg-accent/5">
          <p className="text-xs font-medium text-accent">Cambios sin publicar</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Publicá para crear la versión {(currentVersion ?? 0) + 1}, o descartalos y volvé a la{" "}
            {currentVersion ? `versión ${currentVersion}` : "última publicada"}.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => {
              if (window.confirm("¿Descartar los cambios sin publicar? Se pierde lo editado desde la última publicación.")) {
                onDiscard();
                onClose();
              }
            }}
          >
            <RotateCcw className="size-3.5 mr-1" />
            Descartar cambios
          </Button>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto">
        {versions === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">
            Todavía no publicaste este flujo. Al publicar se guarda la versión 1.
          </p>
        ) : (
          versions.map((row) => {
            const isCurrent = row.version === currentVersion;
            return (
              <div key={row.id} className={cn("flex items-center gap-2 px-3 py-2 border-b last:border-b-0", isCurrent && "bg-primary/5")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">Versión {row.version}</span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                        <Check className="size-3" /> en uso
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => void restore(row)}
                  title="Traer esta versión al editor"
                >
                  {busyId === row.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
