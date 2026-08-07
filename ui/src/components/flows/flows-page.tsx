"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow, Plus, Pause, Play, Trash2, Webhook, ArrowUp, ArrowDown, KeyRound, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { AssistantSetup } from "./assistant-setup";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { FlowStatusPill } from "./flow-status-pill";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/auth.store";
import { useFlowStore } from "@/stores/flow.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { Field } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import type { FlowSummary, PhoneNumber, PhoneScopeChoice } from "@/types";

/**
 * Sobre qué líneas actúa una automatización, en palabras. El disparador guarda
 * una lista vacía cuando aplica a todas, que es lo que menos se adivina desde
 * afuera: por eso se dice explícito.
 */
function describeScope(flow: FlowSummary, phones: PhoneNumber[], allLabel: string): string {
  const ids = flow.triggerPhoneNumberIds;
  if (ids.length === 0) return allLabel;
  const names = ids.map((id) => {
    const phone = phones.find((p) => p.id === id);
    return phone ? phone.label || phone.displayPhone : "—";
  });
  return names.join(" · ");
}

export function FlowsPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const confirm = useConfirm();
  const { flows, isLoading, fetch, fetchTemplates, templates, createFlow, archiveFlow, pauseFlow, activateFlow, updatePriority } = useFlowStore();
  const [showGallery, setShowGallery] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [phones, setPhones] = useState<PhoneNumber[]>([]);

  useEffect(() => {
    if (agent?.role !== "admin") {
      router.push("/");
      return;
    }
    void fetch();
    void fetchTemplates();
    // Los nombres de las líneas, para poder decir sobre cuáles actúa cada
    // automatización sin obligar a abrir el canvas.
    void api.get<PhoneNumber[]>("/phone-numbers").then(setPhones).catch(() => setPhones([]));
  }, [agent?.role, fetch, fetchTemplates, router]);

  const handleCreate = async (scope: PhoneScopeChoice, templateId?: string, name?: string) => {
    setCreating(templateId ?? "blank");
    try {
      const template = templates.find((tp) => tp.id === templateId);
      const flow = await createFlow(name ?? template?.name ?? t.flows.newFlowDefaultName, templateId, scope);
      router.push(`/flows/${flow.id}`);
    } catch (error) {
      setCreating(null);
      toast.error(error instanceof Error ? error.message : t.flows.createFlowError);
    }
  };

  const move = async (flow: FlowSummary, direction: -1 | 1) => {
    // Las base quedan fuera del reordenamiento: son el último recurso de su
    // número y tienen que evaluar después de todo lo demás. Sin este filtro,
    // bajar la última automatización común la intercambiaría con una base y le
    // daría una prioridad normal.
    const ordered = [...flows]
      .filter((f) => f.defaultForPhoneNumberId === null)
      .sort((a, b) => a.priority - b.priority);
    const index = ordered.findIndex((f) => f.id === flow.id);
    if (index === -1) return;
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    await Promise.all([
      updatePriority(flow.id, swapWith.priority),
      updatePriority(swapWith.id, flow.priority),
    ]);
  };

  const archive = async (flow: FlowSummary) => {
    if (!(await confirm({ title: t.flows.archiveConfirm, confirmLabel: t.flows.archive, destructive: true }))) return;
    try {
      await archiveFlow(flow.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.genericError);
    }
  };

  if (agent?.role !== "admin") return null;

  return (
    <PageShell>
      <PageHeader
        title={t.flows.title}
        subtitle={t.flows.subtitle}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowConnections(true)}>
              <KeyRound className="size-4" />
              {t.flows.connections}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGallery(true)}>
              <Plus className="size-4" />
              {t.flows.newFlow}
            </Button>
            <Button size="sm" onClick={() => setShowSetup(true)}>
              <Sparkles className="size-4" />
              Crear con asistente
            </Button>
          </>
        }
      />

      <PageContent width="wide">
        {isLoading && flows.length === 0 ? (
          <LoadingState />
        ) : flows.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title={t.flows.emptyTitle}
            description={t.flows.emptyBody}
            action={
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" onClick={() => setShowSetup(true)}>
                  <Sparkles className="size-4" />
                  Crear con asistente
                </Button>
                <button
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setShowGallery(true)}
                >
                  o empezar desde una plantilla
                </button>
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.flows.priorityHint}</p>
            {[...flows]
              .sort((a, b) => a.priority - b.priority)
              .map((flow, index, ordered) => (
                <FlowRow
                  key={flow.id}
                  flow={flow}
                  phones={phones}
                  isFirst={index === 0}
                  // La última movible es la última que no es base: las base van
                  // siempre al fondo y no participan del reordenamiento.
                  isLast={ordered.slice(index + 1).every((f) => f.defaultForPhoneNumberId !== null)}
                  onOpen={() => router.push(`/flows/${flow.id}`)}
                  onMoveUp={() => void move(flow, -1)}
                  onMoveDown={() => void move(flow, 1)}
                  onPause={() => void pauseFlow(flow.id)}
                  onActivate={() => void activateFlow(flow.id)}
                  onArchive={() => void archive(flow)}
                />
              ))}
          </div>
        )}
      </PageContent>

      <TemplateGallery
        open={showGallery}
        templates={templates}
        phones={phones}
        creating={creating}
        onOpenChange={setShowGallery}
        onPick={(templateId, scope) => void handleCreate(scope, templateId)}
        onBlank={(scope) => void handleCreate(scope)}
      />

      <ResponsiveDialog
        open={showSetup}
        onOpenChange={setShowSetup}
        title="Crear con asistente"
        hideHeader
        size="lg"
      >
        <AssistantSetup
          onCancel={() => setShowSetup(false)}
          onDone={(result) => {
            setShowSetup(false);
            // Cae directo en el builder con el probador a mano: el objetivo es
            // que lo vea funcionar, no que quede mirando una lista.
            router.push(`/flows/${result.flowId}`);
          }}
        />
      </ResponsiveDialog>

      <Sheet open={showConnections} onOpenChange={setShowConnections}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.flows.connections}</SheetTitle>
          </SheetHeader>
          <ConnectionsManager />
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

function FlowRow(props: {
  flow: FlowSummary;
  isFirst: boolean;
  isLast: boolean;
  phones: PhoneNumber[];
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPause: () => void;
  onActivate: () => void;
  onArchive: () => void;
}) {
  const { flow } = props;
  const { t } = useTranslations();
  // La base evalúa siempre última: dejarla mover rompería su razón de ser.
  const isDefault = flow.defaultForPhoneNumberId !== null;
  const scope = describeScope(flow, props.phones, t.flows.allNumbers);

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
      <div className="flex flex-col gap-0.5">
        <button
          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          disabled={props.isFirst || isDefault}
          onClick={props.onMoveUp}
          aria-label={t.flows.movePriorityUp}
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          disabled={props.isLast || isDefault}
          onClick={props.onMoveDown}
          aria-label={t.flows.movePriorityDown}
        >
          <ArrowDown className="size-3.5" />
        </button>
      </div>
      <button className="min-w-0 flex-1 text-left" onClick={props.onOpen}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{flow.name}</span>
          <FlowStatusPill status={flow.status} />
          {isDefault && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {t.flows.baseAutomation}
            </span>
          )}
          {flow.publishedVersion != null && (
            <span className="text-xs text-muted-foreground">v{flow.publishedVersion}</span>
          )}
          {flow.hasWebhookTrigger && <Webhook className="size-3.5 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{scope}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {flow.stats.started} {t.flows.started} · {flow.stats.completed} {t.flows.completed} · {flow.stats.failed} {t.flows.failed}
        </div>
      </button>
      <div className="flex items-center gap-1">
        {flow.status === "published" && (
          <Button variant="ghost" size="icon-sm" onClick={props.onPause} aria-label={t.flows.pause}>
            <Pause className="size-4" />
          </Button>
        )}
        {flow.status === "paused" && (
          <Button variant="ghost" size="icon-sm" onClick={props.onActivate} aria-label={t.flows.resume}>
            <Play className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={props.onArchive} aria-label={t.flows.archive}>
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

/** Valor del selector que representa "todos los números", explícito. */
const ALL_PHONES = "__all__";

function TemplateGallery(props: {
  open: boolean;
  templates: Array<{ id: string; name: string; description: string }>;
  phones: PhoneNumber[];
  creating: string | null;
  onOpenChange: (open: boolean) => void;
  onPick: (templateId: string, scope: PhoneScopeChoice) => void;
  onBlank: (scope: PhoneScopeChoice) => void;
}) {
  const { t } = useTranslations();
  // Con una sola línea no hay nada que preguntar. Con varias sí, y hasta que no
  // se elija no se puede crear: es justo lo que antes quedaba implícito.
  const [target, setTarget] = useState<string>("");
  const only = props.phones.length === 1 ? props.phones[0].id : "";
  const chosen = target || only;
  const scope: PhoneScopeChoice =
    chosen === ALL_PHONES ? { phoneScope: "all" } : { phoneScope: "specific", phoneNumberIds: [chosen] };
  const blocked = !chosen || props.creating !== null;

  return (
    <ResponsiveDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t.flows.newFlow}
      size="lg"
      footer={
        <Button variant="outline" disabled={blocked} onClick={() => props.onBlank(scope)}>
          {props.creating === "blank" ? <Spinner size="sm" /> : null}
          {t.flows.fromScratch}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t.flows.whichNumber} hint={t.flows.whichNumberHint}>
          <SimpleSelect
            value={chosen}
            onChange={setTarget}
            placeholder={t.flows.pickNumber}
            options={[
              ...props.phones.map((p) => ({ value: p.id, label: p.label || p.displayPhone })),
              { value: ALL_PHONES, label: t.flows.allNumbers },
            ]}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {props.templates.map((template) => (
            <button
              key={template.id}
              className="rounded-xl border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
              disabled={blocked}
              onClick={() => props.onPick(template.id, scope)}
            >
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                {template.name}
                {props.creating === template.id && <Spinner size="sm" />}
              </div>
              <div className="text-xs text-muted-foreground">{template.description}</div>
            </button>
          ))}
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function ConnectionsManager() {
  const { t } = useTranslations();
  const confirm = useConfirm();
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t.flows.createConnectionError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!(await confirm({ title: t.flows.deleteConnectionConfirm, confirmLabel: t.common.delete, destructive: true }))) return;
    try {
      await deleteConnection(connectionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.flows.deleteConnectionError);
    }
  };

  return (
    <div className="space-y-5 px-4 pb-6">
      <p className="text-xs text-muted-foreground">{t.flows.connectionsHint}</p>

      <div className="space-y-2 rounded-xl border p-3">
        <Input
          placeholder={t.flows.connectionName}
          aria-label={t.flows.connectionName}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder={t.flows.connectionHeader}
          aria-label={t.flows.connectionHeader}
          value={headerName}
          onChange={(e) => setHeaderName(e.target.value)}
        />
        <Input
          placeholder={t.flows.connectionSecret}
          aria-label={t.flows.connectionSecret}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        {error && <InlineNotice variant="error">{error}</InlineNotice>}
        <Button size="sm" className="w-full" disabled={saving} onClick={() => void handleCreate()}>
          {saving ? <Spinner size="sm" /> : <Plus className="size-3.5" />}
          {t.flows.createConnection}
        </Button>
      </div>

      <div className="space-y-2">
        {connections.map((connection) => (
          <div key={connection.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{connection.name}</div>
              <div className="text-xs text-muted-foreground">{connection.headerName}: ••••••••</div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.flows.deleteConnection}
              onClick={() => void handleDelete(connection.id)}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {connections.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">{t.flows.noConnections}</p>
        )}
      </div>
    </div>
  );
}
