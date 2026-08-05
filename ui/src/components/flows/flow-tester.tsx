"use client";

// Probador del flujo: conversa con el motor real (sin mandar WhatsApp) y
// muestra qué nodo se ejecutó en cada turno. Es lo que permite iterar sin
// publicar ni agarrar otro teléfono.

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, X, SendHorizontal, AlertTriangle, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { NODE_BY_TYPE } from "@/lib/flows/node-catalog";

interface SimOutbound {
  type: string;
  body: string | null;
  mediaUrl?: string | null;
  interactive?: {
    kind?: "buttons" | "list";
    body?: string;
    footer?: string;
    buttons?: Array<{ id: string; title: string }>;
    buttonText?: string;
    rows?: Array<{ id: string; title: string; description?: string }>;
  } | null;
  templateName?: string | null;
}

interface SimStep {
  nodeId: string;
  type: string;
  status: "ok" | "error" | "skipped";
  handle: string | null;
  note: string | null;
}

interface SimResponse {
  session: unknown;
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
  outbound: SimOutbound[];
  sideEffects: Array<{ kind: string; detail: string }>;
  steps: SimStep[];
  currentNodeId: string | null;
  variables: Record<string, unknown>;
  endReason: string | null;
  error: { nodeId: string; message: string } | null;
  waitingOnTimer: boolean;
}

type Entry =
  | { from: "cliente"; text: string }
  | { from: "bot"; message: SimOutbound }
  | { from: "sistema"; text: string; tone: "info" | "error" };

interface Props {
  flowId: string;
  /** true si el borrador tiene cambios sin publicar (se prueba el borrador) */
  onCurrentNodeChange: (nodeId: string | null) => void;
  onClose: () => void;
}

export function FlowTester({ flowId, onCurrentNodeChange, onClose }: Props) {
  const [session, setSession] = useState<unknown>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [steps, setSteps] = useState<SimStep[]>([]);
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<SimResponse["status"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const applyResponse = useCallback(
    (res: SimResponse) => {
      setSession(res.session);
      setStatus(res.status);
      setSteps((prev) => [...prev, ...res.steps]);
      setVariables(res.variables);
      onCurrentNodeChange(res.currentNodeId);

      setEntries((prev) => {
        const next: Entry[] = [...prev, ...res.outbound.map((message) => ({ from: "bot" as const, message }))];
        for (const effect of res.sideEffects) {
          next.push({ from: "sistema", text: effect.detail, tone: "info" });
        }
        if (res.error) next.push({ from: "sistema", text: res.error.message, tone: "error" });
        if (res.waitingOnTimer) {
          next.push({
            from: "sistema",
            text: "La automatización quedó esperando un tiempo. En la prueba los temporizadores no corren.",
            tone: "info",
          });
        }
        if (res.status === "completed") {
          next.push({ from: "sistema", text: `Automatización terminada (${res.endReason ?? "fin"})`, tone: "info" });
        }
        if (res.status === "failed") {
          next.push({ from: "sistema", text: "La automatización se detuvo por un error", tone: "error" });
        }
        return next;
      });
    },
    [onCurrentNodeChange],
  );

  const send = useCallback(
    async (payload: { text?: string; optionId?: string; label?: string }) => {
      if (busy) return;
      setBusy(true);
      if (payload.label ?? payload.text) {
        setEntries((prev) => [...prev, { from: "cliente", text: payload.label ?? payload.text ?? "" }]);
      }
      try {
        const res = await api.post<SimResponse>(`/flows/${flowId}/simulate`, {
          source: "draft",
          session,
          text: payload.text,
          optionId: payload.optionId,
        });
        applyResponse(res);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "No se pudo simular";
        setEntries((prev) => [...prev, { from: "sistema", text: message, tone: "error" }]);
      } finally {
        setBusy(false);
      }
    },
    [applyResponse, busy, flowId, session],
  );

  const reset = () => {
    setSession(null);
    setEntries([]);
    setSteps([]);
    setVariables({});
    setStatus(null);
    setText("");
    onCurrentNodeChange(null);
  };

  const finished = status === "completed" || status === "failed";
  const started = session !== null;

  return (
    <div className="w-96 shrink-0 border-l bg-background flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Play className="size-4 text-primary" />
        <span className="text-sm font-medium flex-1">Probar la automatización</span>
        <button className="text-muted-foreground hover:text-foreground" title="Reiniciar" onClick={reset}>
          <RotateCcw className="size-4" />
        </button>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground px-3 py-1.5 border-b bg-muted/40">
        Corre la automatización del editor sin publicar ni mandar mensajes reales.
      </p>

      {/* ── Conversación ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" style={{ background: "#e5ddd5" }}>
        {!started && (
          <div className="text-center text-xs text-neutral-600 py-8">
            Escribí el primer mensaje del cliente para arrancar.
          </div>
        )}

        {entries.map((entry, index) => {
          if (entry.from === "sistema") {
            return (
              <div key={index} className="flex justify-center">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]",
                    entry.tone === "error" ? "bg-destructive/15 text-destructive" : "bg-black/10 text-neutral-700",
                  )}
                >
                  {entry.tone === "error" ? <AlertTriangle className="size-3" /> : <Info className="size-3" />}
                  {entry.text}
                </span>
              </div>
            );
          }
          if (entry.from === "cliente") {
            return (
              <div key={index} className="flex justify-end">
                <div className="rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-1.5 text-[13px] text-neutral-900 max-w-[85%] shadow-sm">
                  {entry.text}
                </div>
              </div>
            );
          }
          return <BotBubble key={index} message={entry.message} disabled={busy || finished} onTap={send} />;
        })}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
              <Spinner className="size-3.5" />
            </div>
          </div>
        )}
      </div>

      {/* ── Traza + variables ── */}
      {(steps.length > 0 || Object.keys(variables).length > 0) && (
        <div className="border-t max-h-44 overflow-y-auto p-3 space-y-2">
          {steps.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Recorrido</p>
              <div className="space-y-0.5">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-1.5 text-[11px]">
                    <span
                      className={cn(
                        "mt-1 size-1.5 rounded-full shrink-0",
                        step.status === "ok" ? "bg-primary" : step.status === "skipped" ? "bg-muted-foreground" : "bg-destructive",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{NODE_BY_TYPE.get(step.type)?.label ?? step.type}</span>
                      {step.handle && <span className="text-muted-foreground"> → {step.handle}</span>}
                      {step.note && <span className="text-muted-foreground"> · {step.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(variables).length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Variables</p>
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="text-[11px] flex gap-1.5">
                  <code className="text-primary shrink-0">{key}</code>
                  <span className="text-muted-foreground truncate">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Composer ── */}
      <div className="border-t p-2">
        {finished ? (
          <Button variant="outline" size="sm" className="w-full" onClick={reset}>
            <RotateCcw className="size-3.5 mr-1" />
            Probar de nuevo
          </Button>
        ) : (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const value = text.trim();
              if (!value) return;
              setText("");
              void send({ text: value });
            }}
          >
            <Input
              value={text}
              disabled={busy}
              placeholder={started ? "Respondé como el cliente…" : "Primer mensaje del cliente…"}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy || !text.trim()}>
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Burbuja del bot; los botones y filas se pueden tocar para seguir la prueba. */
function BotBubble({
  message,
  disabled,
  onTap,
}: {
  message: SimOutbound;
  disabled: boolean;
  onTap: (p: { optionId?: string; label?: string }) => void;
}) {
  const interactive = message.interactive;
  const options = interactive?.kind === "list" ? (interactive.rows ?? []) : (interactive?.buttons ?? []);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        <div className="rounded-lg rounded-tl-sm bg-white px-3 py-1.5 text-[13px] text-neutral-900 shadow-sm">
          {message.templateName && (
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 mb-0.5">
              Plantilla · {message.templateName}
            </p>
          )}
          {message.mediaUrl && (
            <p className="text-[11px] text-neutral-500 mb-1">📎 {message.mediaUrl}</p>
          )}
          <p className="whitespace-pre-wrap break-words">
            {interactive?.body ?? message.body ?? <span className="text-neutral-400">(sin texto)</span>}
          </p>
          {interactive?.footer && <p className="text-[11px] text-neutral-500 mt-1">{interactive.footer}</p>}
        </div>

        {options.map((option) => (
          <button
            key={option.id}
            disabled={disabled}
            className="block w-full rounded-lg bg-white py-1.5 text-center text-[13px] text-sky-600 shadow-sm hover:bg-sky-50 disabled:opacity-60"
            onClick={() => onTap({ optionId: option.id, label: option.title })}
          >
            {option.title}
          </button>
        ))}
      </div>
    </div>
  );
}
