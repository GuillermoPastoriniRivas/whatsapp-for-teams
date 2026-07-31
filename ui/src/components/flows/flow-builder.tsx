"use client";
"use no memo";

// Orquestador del builder: carga el flujo, mantiene el grafo en el estado de
// xyflow, autoguarda el borrador, publica con validación y muestra el panel
// de configuración del nodo seleccionado.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNodesState, useEdgesState, type Node, type Edge, type Connection } from "@xyflow/react";
import {
  ArrowLeft, Loader2, Rocket, Pause, Play, AlertTriangle, BarChart3, Webhook, Copy, RefreshCw, X, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useAuthStore } from "@/stores/auth.store";
import { useLabelStore } from "@/stores/label.store";
import { NODE_BY_TYPE, nodeHandles, isTriggerType } from "@/lib/flows/node-catalog";
import { computeHandleRemap } from "@/lib/flows/handle-remap";
import { FlowCanvas } from "./flow-canvas";
import { NodePalette } from "./node-palette";
import { NodeConfigPanel, type BuilderRefs } from "./node-config-panel";
import { ExecutionsPanel } from "./executions-panel";
import { VersionsPanel } from "./versions-panel";
import type {
  FlowDetailResponse, FlowGraph, FlowNode, FlowGraphIssue, FlowNodeStatsSummary,
  AiAgentWithConfig, Agent, PhoneNumber, MessageTemplate, PaginatedResponse,
} from "@/types";
import type { CanvasNodeData } from "./flow-node";

const AUTOSAVE_MS = 1500;

function toCanvasNodes(graph: FlowGraph): Node[] {
  return graph.nodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position,
    // Sin esto Supr/Backspace borra el disparador y el flujo queda inservible:
    // la paleta no ofrece triggers para volver a agregarlo.
    deletable: !isTriggerType(n.type),
    data: { nodeType: n.type, config: n.data } satisfies CanvasNodeData,
  }));
}

function toCanvasEdges(graph: FlowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    type: "smoothstep",
  }));
}

function fromCanvas(nodes: Node[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => {
      const data = n.data as CanvasNodeData;
      return { id: n.id, type: data.nodeType, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: data.config };
    }),
    edges: edges
      .filter((e) => e.sourceHandle)
      .map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle!, target: e.target })),
  };
}

export function FlowBuilder({ flowId }: { flowId: string }) {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const labelStore = useLabelStore();

  const [detail, setDetail] = useState<FlowDetailResponse | null>(null);
  const [name, setName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [issues, setIssues] = useState<FlowGraphIssue[]>([]);
  const [warnings, setWarnings] = useState<FlowGraphIssue[]>([]);
  const [view, setView] = useState<"editor" | "executions">("editor");
  const [showVersions, setShowVersions] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<FlowNodeStatsSummary[]>([]);
  const [refs, setRefs] = useState<BuilderRefs>({ labels: [], aiAgents: [], agents: [], phones: [], templates: [], connections: [] });

  const loadedRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ graph: FlowGraph; name: string } | null>(null);
  const nodeCounterRef = useRef(0);

  // ── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    if (agent?.role !== "admin") {
      router.push("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get<FlowDetailResponse>(`/flows/${flowId}`);
        if (cancelled) return;
        setDetail(response);
        setName(response.flow.name);
        setNodes(toCanvasNodes(response.flow.draftGraph));
        setEdges(toCanvasEdges(response.flow.draftGraph));
        lastSavedRef.current = JSON.stringify({ graph: response.flow.draftGraph, name: response.flow.name });
        loadedRef.current = true;
      } catch {
        router.push("/flows");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent?.role, flowId, router, setEdges, setNodes]);

  // Referencias para los formularios de config (bots, agentes, líneas, plantillas, conexiones).
  useEffect(() => {
    void labelStore.fetch();
    (async () => {
      const [aiAgents, agents, phones, templates, connections] = await Promise.all([
        api.get<AiAgentWithConfig[]>("/ai-agents").catch(() => []),
        api.get<Agent[]>("/agents").catch(() => []),
        api.get<PhoneNumber[]>("/phone-numbers").catch(() => []),
        api.get<PaginatedResponse<MessageTemplate>>("/templates?page=1&limit=100").catch(() => null),
        api.get<Array<{ id: string; name: string; headerName: string }>>("/flow-connections").catch(() => []),
      ]);
      setRefs((prev) => ({
        ...prev,
        aiAgents,
        agents: agents.filter((a) => a.type !== "ai"),
        phones,
        templates: templates?.data ?? [],
        connections,
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRefs((prev) => ({ ...prev, labels: labelStore.labels }));
  }, [labelStore.labels]);

  // ── Autosave del borrador ────────────────────────────────────
  // Guarda lo último pendiente en un ref para poder forzar el guardado antes
  // de publicar: si no, se versiona un grafo viejo y los últimos cambios no
  // llegan a producción sin que nadie se entere.
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return true;
    if (JSON.stringify(pending) === lastSavedRef.current) return true;

    setSaveState("saving");
    try {
      await api.patch(`/flows/${flowId}`, { draftGraph: pending.graph, name: pending.name });
      lastSavedRef.current = JSON.stringify(pending);
      setSaveState("saved");
      return true;
    } catch (error: any) {
      setSaveState("dirty");
      setSaveError(error?.message ?? "No se pudo guardar el borrador");
      return false;
    }
  }, [flowId]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const pending = { graph: fromCanvas(nodes, edges), name };
    pendingRef.current = pending;
    if (JSON.stringify(pending) === lastSavedRef.current) return;
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void flushSave(), AUTOSAVE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, name, flushSave]);

  // Al salir del builder se vuelca lo pendiente (el debounce perdería hasta
  // 1,5 s de edición).
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!pending || JSON.stringify(pending) === lastSavedRef.current) return;
      void api.patch(`/flows/${flowId}`, { draftGraph: pending.graph, name: pending.name }).catch(() => {});
    };
  }, [flowId]);

  // ── Mutaciones del grafo ─────────────────────────────────────
  const addNode = useCallback(
    (nodeType: string, position?: { x: number; y: number }) => {
      const def = NODE_BY_TYPE.get(nodeType);
      if (!def) return;
      nodeCounterRef.current += 1;
      const id = `n${Date.now().toString(36)}${nodeCounterRef.current}`;
      const fallbackPosition = { x: 320 + nodes.length * 24, y: 160 + nodes.length * 16 };
      setNodes((current) => [
        ...current,
        {
          id,
          type: "flowNode",
          position: position ?? fallbackPosition,
          deletable: !isTriggerType(nodeType),
          data: { nodeType, config: structuredClone(def.defaultData) } satisfies CanvasNodeData,
        },
      ]);
      setSelectedId(id);
    },
    [nodes.length, setNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) return;
      setEdges((current) => [
        // Una sola conexión por salida: la nueva reemplaza a la anterior.
        ...current.filter((e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle)),
        {
          id: `e${connection.source}-${connection.sourceHandle}-${connection.target}`,
          source: connection.source,
          sourceHandle: connection.sourceHandle,
          target: connection.target,
          type: "smoothstep",
        },
      ]);
    },
    [setEdges],
  );

  const updateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      const previous = nodes.find((n) => n.id === nodeId)?.data as CanvasNodeData | undefined;
      const nodeType = previous?.nodeType;

      setNodes((current) =>
        current.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data as CanvasNodeData), config } } : n)),
      );
      if (!nodeType) return;

      // Primero se mueven las ramas que cambiaron de handle (opción borrada del
      // medio, clave renombrada); recién después se descarta lo que ya no existe.
      const remap = computeHandleRemap(nodeType, previous?.config ?? {}, config);
      const valid = new Set(
        nodeHandles({ id: nodeId, type: nodeType, position: { x: 0, y: 0 }, data: config }).map((h) => h.id),
      );
      setEdges((current) =>
        current
          .map((e) => {
            if (e.source !== nodeId || !e.sourceHandle || !remap.has(e.sourceHandle)) return e;
            const target = remap.get(e.sourceHandle);
            return target ? { ...e, sourceHandle: target } : null;
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .filter((e) => e.source !== nodeId || valid.has(e.sourceHandle ?? "")),
      );
    },
    [nodes, setEdges, setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const nodeType = (nodes.find((n) => n.id === nodeId)?.data as CanvasNodeData | undefined)?.nodeType;
      if (nodeType?.startsWith("trigger.")) return; // el trigger no se borra
      setNodes((current) => current.filter((n) => n.id !== nodeId));
      setEdges((current) => current.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedId(null);
    },
    [nodes, setEdges, setNodes],
  );

  const changeTriggerType = useCallback(
    (nodeId: string, newType: string) => {
      const def = NODE_BY_TYPE.get(newType);
      if (!def) return;
      setNodes((current) =>
        current.map((n) =>
          n.id === nodeId
            ? { ...n, data: { nodeType: newType, config: structuredClone(def.defaultData) } satisfies CanvasNodeData }
            : n,
        ),
      );
    },
    [setNodes],
  );

  // ── Publicar / pausar ────────────────────────────────────────
  const publish = async () => {
    if (!window.confirm(`${t.flows.publishConfirmTitle}\n\n${t.flows.publishConfirmBody}`)) return;
    setPublishing(true);
    setIssues([]);
    setWarnings([]);
    // Sin esto se publica el último borrador guardado, no lo que está en pantalla.
    if (!(await flushSave())) {
      setPublishing(false);
      setIssues([{ code: "save_failed", message: "No se pudo guardar el borrador antes de publicar. Reintentá." }]);
      return;
    }
    try {
      const result = await api.post<{ version: number; warnings: FlowGraphIssue[]; webhookToken: string | null }>(
        `/flows/${flowId}/publish`,
      );
      setWarnings(result.warnings ?? []);
      const response = await api.get<FlowDetailResponse>(`/flows/${flowId}`);
      setDetail(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const data = error.data as { errors?: FlowGraphIssue[] } | undefined;
        setIssues(data?.errors ?? [{ code: "unknown", message: error.message }]);
      } else if (error instanceof ApiError) {
        setIssues([{ code: "error", message: error.message }]);
      }
    } finally {
      setPublishing(false);
    }
  };

  const togglePause = async () => {
    if (!detail) return;
    if (detail.flow.status === "published") await api.post(`/flows/${flowId}/pause`);
    else if (detail.flow.status === "paused") await api.post(`/flows/${flowId}/activate`);
    const response = await api.get<FlowDetailResponse>(`/flows/${flowId}`);
    setDetail(response);
  };

  /** Trae un grafo publicado al borrador; el autosave lo persiste como draft. */
  const loadGraphIntoDraft = useCallback(
    (graph: FlowGraph) => {
      setNodes(toCanvasNodes(graph));
      setEdges(toCanvasEdges(graph));
      setSelectedId(null);
      setIssues([]);
      setWarnings([]);
      // El badge "cambios sin publicar" se recalcula acá: si volvimos a la
      // versión en uso ya no hay nada pendiente; si trajimos una vieja, sí.
      setDetail((current) =>
        current
          ? {
              ...current,
              hasUnpublishedChanges: current.publishedVersion
                ? JSON.stringify(graph) !== JSON.stringify(current.publishedVersion.graph)
                : graph.nodes.length > 0,
            }
          : current,
      );
    },
    [setEdges, setNodes],
  );

  // ── Stats overlay ────────────────────────────────────────────
  useEffect(() => {
    if (!showStats) return;
    void api
      .get<FlowNodeStatsSummary[]>(`/flows/${flowId}/stats?days=30`)
      .then(setStats)
      .catch(() => setStats([]));
  }, [showStats, flowId]);

  const errorNodeIds = useMemo(() => new Set(issues.map((i) => i.nodeId).filter(Boolean) as string[]), [issues]);
  const statByNode = useMemo(() => new Map(stats.map((s) => [s.nodeId, s])), [stats]);

  const decoratedNodes = useMemo(
    () =>
      nodes.map((n) => {
        const data = n.data as CanvasNodeData;
        const stat = showStats ? statByNode.get(n.id) : null;
        return {
          ...n,
          data: {
            ...data,
            hasError: errorNodeIds.has(n.id),
            stat: stat ? { entered: stat.entered, errors: stat.errors } : null,
          } satisfies CanvasNodeData,
        };
      }),
    [nodes, errorNodeIds, showStats, statByNode],
  );

  const selectedNode: FlowNode | null = useMemo(() => {
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return null;
    const data = node.data as CanvasNodeData;
    return { id: node.id, type: data.nodeType, position: node.position, data: data.config };
  }, [nodes, selectedId]);

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const flow = detail.flow;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
  const webhookUrl = flow.webhookToken ? `${apiBase}/hooks/flows/${flow.id}/${flow.webhookToken}` : null;

  return (
    // h-full, no h-screen: el <main> del layout ya es flex-1 + overflow-hidden
    // y mide menos que el viewport (banner/header), así que 100vh se recortaba
    // por abajo y las columnas nunca llegaban a scrollear.
    <div className="zoom-neutral flex flex-col h-full overflow-hidden">
      {/* ── Barra superior ── */}
      <div className="flex items-center gap-3 border-b px-3 py-2 bg-background shrink-0 flex-wrap">
        <Link href="/flows" className="text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="size-4" />
        </Link>
        <input
          className="font-medium bg-transparent outline-none border-b border-transparent focus:border-primary text-sm min-w-0 flex-1 max-w-64"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <StatusPill status={flow.status} version={flow.publishedVersion} />
        {detail.hasUnpublishedChanges && flow.status !== "draft" && (
          <Badge variant="outline" className="text-accent border-accent/40">{t.flows.unsavedChanges}</Badge>
        )}
        <span
          className={cn("text-xs w-20", saveError ? "text-destructive" : "text-muted-foreground")}
          title={saveError ?? undefined}
        >
          {saveError ? "Sin guardar" : saveState === "saving" ? t.flows.saving : saveState === "saved" ? t.flows.saved : "…"}
        </span>
        <div className="flex-1" />
        <Tabs value={view} onValueChange={(v) => setView(v as "editor" | "executions")}>
          <TabsList className="h-8">
            <TabsTrigger value="editor" className="text-xs px-3">{t.flows.editor}</TabsTrigger>
            <TabsTrigger value="executions" className="text-xs px-3">{t.flows.executions}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant={showVersions ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowVersions((v) => !v)}
          title="Historial de versiones"
        >
          <History className="size-3.5 mr-1" />
          Versiones
          {detail.hasUnpublishedChanges && flow.status !== "draft" && (
            <span className="ml-1.5 size-1.5 rounded-full bg-accent" aria-hidden />
          )}
        </Button>
        <Button
          variant={showStats ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowStats((s) => !s)}
          title="Actividad por nodo"
        >
          <BarChart3 className="size-4" />
        </Button>
        {(flow.status === "published" || flow.status === "paused") && (
          <Button variant="outline" size="sm" onClick={() => void togglePause()}>
            {flow.status === "published" ? (
              <><Pause className="size-3.5 mr-1" />{t.flows.pause}</>
            ) : (
              <><Play className="size-3.5 mr-1" />{t.flows.resume}</>
            )}
          </Button>
        )}
        <Button size="sm" disabled={publishing} onClick={() => void publish()}>
          {publishing ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Rocket className="size-3.5 mr-1" />}
          {t.flows.publish}
        </Button>
      </div>

      {showVersions && (
        <VersionsPanel
          flowId={flowId}
          currentVersion={flow.publishedVersion}
          hasUnpublishedChanges={detail.hasUnpublishedChanges}
          onRestore={(graph) => loadGraphIntoDraft(graph)}
          onDiscard={() => {
            // Descartar = volver el borrador a lo que hoy corre en producción.
            if (detail.publishedVersion) loadGraphIntoDraft(detail.publishedVersion.graph);
          }}
          onClose={() => setShowVersions(false)}
        />
      )}

      {flow.status === "paused" && (
        <div className="text-xs text-accent bg-accent/10 px-4 py-1.5">{t.flows.pausedHint}</div>
      )}

      {webhookUrl && view === "editor" && (
        <div className="flex items-center gap-2 text-xs bg-muted/60 px-4 py-1.5 border-b overflow-x-auto">
          <Webhook className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground shrink-0">{t.flows.webhookUrl}:</span>
          <code className="truncate">{webhookUrl}</code>
          <button
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => void navigator.clipboard.writeText(webhookUrl)}
            title="Copiar"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            className="text-muted-foreground hover:text-foreground shrink-0"
            title={t.flows.regenerateToken}
            onClick={async () => {
              await api.post(`/flows/${flowId}/webhook-token`);
              const response = await api.get<FlowDetailResponse>(`/flows/${flowId}`);
              setDetail(response);
            }}
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Errores / warnings de publicación ── */}
      {(issues.length > 0 || warnings.length > 0) && view === "editor" && (
        <div className="border-b bg-background px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
          {issues.length > 0 && (
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="size-3.5" />
              {t.flows.publishErrors}
              <button className="ml-auto text-muted-foreground" onClick={() => setIssues([])}><X className="size-3.5" /></button>
            </p>
          )}
          {issues.map((issue, index) => (
            <button
              key={`e${index}`}
              className="block text-xs text-destructive/90 hover:underline text-left"
              onClick={() => issue.nodeId && setSelectedId(issue.nodeId)}
            >
              • {issue.message}
            </button>
          ))}
          {warnings.map((warning, index) => (
            <p key={`w${index}`} className="text-xs text-accent">
              ⚠ {warning.message}
            </p>
          ))}
        </div>
      )}

      {/* ── Cuerpo ── */}
      {view === "executions" ? (
        <ExecutionsPanel flowId={flowId} />
      ) : (
        <div className="flex flex-1 min-h-0">
          <div className="hidden md:block h-full min-h-0">
            <NodePalette onAdd={(type) => addNode(type)} />
          </div>
          <div className="flex-1 min-w-0 relative">
            <FlowCanvas
              nodes={decoratedNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectNode={setSelectedId}
              onDropNode={(type, position) => addNode(type, position)}
            />
            <div className="md:hidden absolute inset-x-0 top-0 text-center text-xs bg-accent/10 text-accent py-1">
              {t.flows.mobileReadOnly}
            </div>
          </div>
          {selectedNode && (
            <div className="hidden md:flex w-80 shrink-0 border-l bg-background flex-col h-full min-h-0">
              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                refs={refs}
                allNodes={nodes.map((n) => {
                  const data = n.data as CanvasNodeData;
                  return { id: n.id, type: data.nodeType, position: n.position, data: data.config };
                })}
                edges={edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? "", target: e.target }))}
                onChange={(config) => updateNodeConfig(selectedNode.id, config)}
                onChangeTriggerType={(newType) => changeTriggerType(selectedNode.id, newType)}
                onDelete={() => deleteNode(selectedNode.id)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, version }: { status: string; version: number | null }) {
  const { t } = useTranslations();
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: t.flows.statusDraft, className: "bg-muted text-muted-foreground" },
    published: { label: t.flows.statusPublished, className: "bg-primary/10 text-primary" },
    paused: { label: t.flows.statusPaused, className: "bg-accent/10 text-accent" },
  };
  const style = map[status] ?? map.draft;
  return (
    <Badge variant="secondary" className={style.className}>
      {style.label}
      {version != null && status !== "draft" ? ` · v${version}` : ""}
    </Badge>
  );
}
