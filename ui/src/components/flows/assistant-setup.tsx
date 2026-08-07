"use client";

// Alta guiada: cuatro preguntas cerradas y sale un bot que contesta.
//
// Todo lo que se pregunta acá lo sabe cualquier dueño de negocio sin pensar.
// Nada de "elegí un disparador" ni "definí una variable": esa traducción la
// hace el generador del backend.

import { useState } from "react";
import { Sparkles, ArrowLeft, ArrowRight, Check, MessageSquare, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Vertical = "beauty" | "food" | "retail" | "generic";
type Fallback = "ai" | "human" | "message";

const VERTICALS: Array<{ value: Vertical; label: string; hint: string }> = [
  { value: "beauty", label: "Estética y belleza", hint: "peluquería, spa, uñas" },
  { value: "food", label: "Gastronomía", hint: "restaurante, delivery, cafetería" },
  { value: "retail", label: "Tienda", hint: "ropa, kiosco, e-commerce" },
  { value: "generic", label: "Otro rubro", hint: "servicios, oficios, profesionales" },
];

// Espeja TOPICS_BY_VERTICAL del backend.
const TOPICS: Record<Vertical, Array<{ id: string; label: string }>> = {
  beauty: [
    { id: "turno", label: "Sacar un turno" },
    { id: "precios", label: "Precios" },
    { id: "horarios", label: "Horarios" },
    { id: "ubicacion", label: "Dónde estamos" },
  ],
  food: [
    { id: "pedido", label: "Hacer un pedido" },
    { id: "precios", label: "Ver la carta" },
    { id: "horarios", label: "Horarios" },
    { id: "ubicacion", label: "Dónde estamos" },
  ],
  retail: [
    { id: "stock", label: "Consultar stock" },
    { id: "precios", label: "Precios" },
    { id: "horarios", label: "Horarios" },
    { id: "ubicacion", label: "Dónde estamos" },
  ],
  generic: [
    { id: "precios", label: "Precios" },
    { id: "horarios", label: "Horarios" },
    { id: "ubicacion", label: "Dónde estamos" },
  ],
};

const FALLBACKS: Array<{ value: Fallback; label: string; hint: string }> = [
  { value: "ai", label: "Que siga el asistente", hint: "responde con lo que sabe del negocio" },
  { value: "human", label: "Avisame a mí", hint: "la conversación pasa a tu equipo" },
  { value: "message", label: "Que deje su mensaje", hint: "le contestás cuando puedas" },
];

const DAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "M" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

interface SetupResult {
  aiAgentId: string;
  flowId: string;
  published: boolean;
  publishBlockedReason: string | null;
}

interface Props {
  onDone: (result: SetupResult) => void;
  onCancel?: () => void;
}

export function AssistantSetup({ onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [vertical, setVertical] = useState<Vertical>("generic");
  const [address, setAddress] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [fallback, setFallback] = useState<Fallback>("ai");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("18:00");

  const available = TOPICS[vertical];
  const canContinue = [
    businessName.trim().length > 0,
    true, // los temas son opcionales: siempre queda "hablar con alguien"
    true,
    days.length > 0 && !!from && !!to,
  ][step];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<SetupResult>("/flows/assistant-setup", {
        businessName: businessName.trim(),
        vertical,
        address: address.trim() || undefined,
        topics,
        fallback,
        schedule: {
          days,
          from,
          to,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Montevideo",
        },
      });
      onDone(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos crear el asistente");
      setBusy(false);
    }
  };

  const steps = [
    {
      title: "¿Cómo se llama tu negocio?",
      subtitle: "Lo usamos para que el bot se presente como corresponde.",
      content: (
        <div className="space-y-4">
          <Field label="Nombre del negocio">
            <Input
              autoFocus
              placeholder="Ej: Barbería Don Pedro"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">¿A qué se dedica?</p>
            <div className="grid grid-cols-2 gap-2">
              {VERTICALS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => {
                    setVertical(v.value);
                    setTopics([]);
                  }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    vertical === v.value ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-medium">{v.label}</span>
                  <span className="block text-xs text-muted-foreground">{v.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <Field label="Dirección (opcional)">
            <Input
              placeholder="Av. Siempre Viva 123"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
        </div>
      ),
    },
    {
      title: "¿Qué te preguntan todo el tiempo?",
      subtitle: "Elegí lo que más se repite. El bot va a ofrecerlo como menú.",
      content: (
        <div className="space-y-2">
          {available.map((topic) => {
            const checked = topics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() =>
                  setTopics((prev) => (checked ? prev.filter((t) => t !== topic.id) : [...prev, topic.id]))
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                  )}
                >
                  {checked && <Check className="size-3.5" />}
                </span>
                <span className="text-sm font-medium">{topic.label}</span>
              </button>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">
            «Hablar con alguien» se agrega siempre, no hace falta que la elijas.
          </p>
        </div>
      ),
    },
    {
      title: "¿Y si preguntan otra cosa?",
      subtitle: "Lo que pasa cuando la consulta no está en el menú.",
      content: (
        <div className="space-y-2">
          {FALLBACKS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFallback(option.value)}
              className={cn(
                "block w-full rounded-xl border p-3 text-left transition-colors",
                fallback === option.value ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "¿Cuándo atendés?",
      subtitle: "El bot lo usa para responder horarios y para saber cuándo estás.",
      content: (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Días</p>
            <div className="flex gap-1.5">
              {DAYS.map((day, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setDays((prev) =>
                      prev.includes(day.value) ? prev.filter((d) => d !== day.value) : [...prev, day.value],
                    )
                  }
                  className={cn(
                    "size-9 rounded-lg border text-sm font-medium transition-colors",
                    days.includes(day.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Desde" className="flex-1">
              <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Hasta" className="flex-1">
              <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{current.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p>
      </div>

      <div className="mb-5 flex justify-center gap-1.5">
        {steps.map((_, index) => (
          <span
            key={index}
            className={cn("h-1 w-8 rounded-full transition-colors", index <= step ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>

      {current.content}

      {error && (
        <div className="mt-4">
          <InlineNotice variant="error">{error}</InlineNotice>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            <ArrowLeft className="size-4" />
            Atrás
          </Button>
        ) : onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button
          size="lg"
          disabled={!canContinue || busy}
          onClick={() => (isLast ? void submit() : setStep((s) => s + 1))}
        >
          {busy ? (
            <>
              <Spinner className="size-4" />
              Creando tu asistente…
            </>
          ) : isLast ? (
            <>
              <Sparkles className="size-4" />
              Crear mi asistente
            </>
          ) : (
            <>
              Seguir
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Pantalla de cierre: qué quedó armado y cómo probarlo ya mismo. */
export function AssistantSetupResult({
  result,
  onOpenFlow,
  onGoToInbox,
}: {
  result: SetupResult;
  onOpenFlow: () => void;
  onGoToInbox: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-lg text-center">
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10">
        <Check className="size-6 text-primary" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">Tu asistente está listo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {result.published
          ? "Ya está activo: escribile a tu número de WhatsApp desde otro teléfono y te va a contestar."
          : "Quedó guardado como borrador. Revisalo y publicalo cuando quieras."}
      </p>

      {!result.published && result.publishBlockedReason && (
        <div className="mt-4 text-left">
          <InlineNotice variant="warning">{result.publishBlockedReason}</InlineNotice>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <Button size="lg" className="w-full" onClick={onOpenFlow}>
          <Play className="size-4" />
          Probarlo acá mismo
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={onGoToInbox}>
          <MessageSquare className="size-4" />
          Ir a mis conversaciones
        </Button>
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Podés mejorarlo cuando quieras: cargale tus precios y preguntas frecuentes desde el asistente,
        o editá el menú desde la automatización.
      </p>
    </div>
  );
}
