"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow, Plus, Loader2, Pause, Play, Trash2, Webhook, ArrowUp, ArrowDown, KeyRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth.store";
import { useFlowStore } from "@/stores/flow.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { FlowSummary, FlowStatus } from "@/types";

export function FlowsPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const { flows, isLoading, fetch, fetchTemplates, templates, createFlow, archiveFlow, pauseFlow, activateFlow, updatePriority } = useFlowStore();
  const [showGallery, setShowGallery] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (agent?.role !== "admin") {
      router.push("/");
      return;
    }
    void fetch();
    void fetchTemplates();
  }, [agent?.role, fetch, fetchTemplates, router]);

  const handleCreate = async (templateId?: string, name?: string) => {
    setCreating(templateId ?? "blank");
    try {
      const template = templates.find((tp) => tp.id === templateId);
      const flow = await createFlow(name ?? template?.name ?? "Nuevo flujo", templateId);
      router.push(`/flows/${flow.id}`);
    } catch {
      setCreating(null);
    }
  };

  const move = async (flow: FlowSummary, direction: -1 | 1) => {
    const ordered = [...flows].sort((a, b) => a.priority - b.priority);
    const index = ordered.findIndex((f) => f.id === flow.id);
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    await Promise.all([
      updatePriority(flow.id, swapWith.priority),
      updatePriority(swapWith.id, flow.priority),
    ]);
  };

  if (agent?.role !== "admin") return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 pb-20 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Workflow className="size-5 text-primary" />
            {t.flows.title}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConnections(true)}>
              <KeyRound className="size-4 mr-1" />
              {t.flows.connections}
            </Button>
            <Button size="sm" onClick={() => setShowGallery(true)}>
              <Plus className="size-4 mr-1" />
              {t.flows.newFlow}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{t.flows.subtitle}</p>

        {isLoading && flows.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : flows.length === 0 ? (
          <EmptyState onCreate={() => setShowGallery(true)} />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.flows.priorityHint}</p>
            {[...flows]
              .sort((a, b) => a.priority - b.priority)
              .map((flow, index, ordered) => (
                <FlowRow
                  key={flow.id}
                  flow={flow}
                  isFirst={index === 0}
                  isLast={index === ordered.length - 1}
                  onOpen={() => router.push(`/flows/${flow.id}`)}
                  onMoveUp={() => void move(flow, -1)}
                  onMoveDown={() => void move(flow, 1)}
                  onPause={() => void pauseFlow(flow.id)}
                  onActivate={() => void activateFlow(flow.id)}
                  onArchive={() => {
                    if (window.confirm(t.flows.archiveConfirm)) void archiveFlow(flow.id);
                  }}
                />
              ))}
          </div>
        )}

        {showGallery && (
          <TemplateGallery
            templates={templates}
            creating={creating}
            onClose={() => setShowGallery(false)}
            onPick={(templateId) => void handleCreate(templateId)}
            onBlank={() => void handleCreate(undefined)}
          />
        )}

        <Sheet open={showConnections} onOpenChange={setShowConnections}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t.flows.connections}</SheetTitle>
            </SheetHeader>
            <ConnectionsManager />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslations();
  return (
    <div className="border border-dashed rounded-xl p-10 text-center">
      <Workflow className="size-10 mx-auto text-primary mb-3" />
      <h2 className="text-lg font-semibold mb-1">{t.flows.emptyTitle}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">{t.flows.emptyBody}</p>
      <Button onClick={onCreate}>
        <Plus className="size-4 mr-1" />
        {t.flows.newFlow}
      </Button>
    </div>
  );
}

function StatusPill({ status }: { status: FlowStatus }) {
  const { t } = useTranslations();
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: t.flows.statusDraft, className: "bg-muted text-muted-foreground" },
    published: { label: t.flows.statusPublished, className: "bg-primary/10 text-primary" },
    paused: { label: t.flows.statusPaused, className: "bg-accent/10 text-accent" },
  };
  const style = map[status] ?? map.draft;
  return <Badge variant="secondary" className={style.className}>{style.label}</Badge>;
}

function FlowRow(props: {
  flow: FlowSummary;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPause: () => void;
  onActivate: () => void;
  onArchive: () => void;
}) {
  const { flow } = props;
  const { t } = useTranslations();
  return (
    <div className="border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
      <div className="flex flex-col gap-0.5">
        <button className="text-muted-foreground/60 hover:text-foreground disabled:opacity-20" disabled={props.isFirst} onClick={props.onMoveUp} aria-label="Subir prioridad">
          <ArrowUp className="size-3.5" />
        </button>
        <button className="text-muted-foreground/60 hover:text-foreground disabled:opacity-20" disabled={props.isLast} onClick={props.onMoveDown} aria-label="Bajar prioridad">
          <ArrowDown className="size-3.5" />
        </button>
      </div>
      <button className="flex-1 text-left min-w-0" onClick={props.onOpen}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{flow.name}</span>
          <StatusPill status={flow.status} />
          {flow.publishedVersion != null && (
            <span className="text-xs text-muted-foreground">v{flow.publishedVersion}</span>
          )}
          {flow.hasWebhookTrigger && <Webhook className="size-3.5 text-muted-foreground" />}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {flow.stats.started} {t.flows.started} · {flow.stats.completed} {t.flows.completed} · {flow.stats.failed} {t.flows.failed}
        </div>
      </button>
      <div className="flex items-center gap-1">
        {flow.status === "published" && (
          <Button variant="ghost" size="sm" onClick={props.onPause} title={t.flows.pause}>
            <Pause className="size-4" />
          </Button>
        )}
        {flow.status === "paused" && (
          <Button variant="ghost" size="sm" onClick={props.onActivate} title={t.flows.resume}>
            <Play className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={props.onArchive} title={t.flows.archive}>
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function TemplateGallery(props: {
  templates: Array<{ id: string; name: string; description: string }>;
  creating: string | null;
  onClose: () => void;
  onPick: (templateId: string) => void;
  onBlank: () => void;
}) {
  const { t } = useTranslations();
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={props.onClose}>
      <div className="bg-background rounded-xl border max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t.flows.newFlow}</h2>
          <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {props.templates.map((template) => (
            <button
              key={template.id}
              className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              disabled={props.creating !== null}
              onClick={() => props.onPick(template.id)}
            >
              <div className="font-medium text-sm mb-1 flex items-center gap-2">
                {template.name}
                {props.creating === template.id && <Loader2 className="size-3.5 animate-spin" />}
              </div>
              <div className="text-xs text-muted-foreground">{template.description}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" disabled={props.creating !== null} onClick={props.onBlank}>
            {props.creating === "blank" ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
            {t.flows.fromScratch}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConnectionsManager() {
  const { connections, fetchConnections, createConnection, deleteConnection } = useFlowStore();
  const [name, setName] = useState("");
  const [headerName, setHeaderName] = useState("Authorization");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const handleCreate = async () => {
    if (!name.trim() || !headerName.trim() || !secret.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createConnection(name.trim(), headerName.trim(), secret);
      setName("");
      setSecret("");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear la conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pb-6 space-y-5">
      <p className="text-xs text-muted-foreground">
        Guardá acá los tokens de tus integraciones (MercadoPago, tu CRM, etc.). El secreto se cifra y
        nunca vuelve a mostrarse: los nodos HTTP lo usan eligiendo la conexión, sin pegarlo en el flujo.
      </p>

      <div className="space-y-2 border rounded-lg p-3">
        <Input placeholder="Nombre (ej: MercadoPago producción)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Header (ej: Authorization)" value={headerName} onChange={(e) => setHeaderName(e.target.value)} />
        <Input placeholder="Secreto (ej: Bearer APP_USR-…)" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" className="w-full" disabled={saving} onClick={() => void handleCreate()}>
          {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Plus className="size-3.5 mr-1" />}
          Crear conexión
        </Button>
      </div>

      <div className="space-y-2">
        {connections.map((connection) => (
          <div key={connection.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{connection.name}</div>
              <div className="text-xs text-muted-foreground">{connection.headerName}: ••••••••</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm("¿Eliminar esta conexión?")) {
                  void deleteConnection(connection.id).catch((e: any) =>
                    window.alert(e?.message ?? "La conexión está en uso por un flujo publicado"),
                  );
                }
              }}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {connections.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Sin conexiones todavía.</p>
        )}
      </div>
    </div>
  );
}
