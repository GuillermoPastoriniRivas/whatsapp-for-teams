"use client";

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Bot, Save, Trash2, Send, Plus } from "lucide-react";
import type {
  AiAgentWithConfig, BusinessHours, BusinessHoursRange, WeekDay,
  BusinessVertical, CatalogItem, FaqEntry,
} from "@/types";

interface Props {
  agent: AiAgentWithConfig;
  onUpdated: () => void;
  onDeleted: () => void;
}

const verticals: { value: BusinessVertical; label: string; catalogLabel: string }[] = [
  { value: "beauty", label: "Estética y belleza", catalogLabel: "Servicios y precios" },
  { value: "food", label: "Gastronomía", catalogLabel: "Menú y precios" },
  { value: "retail", label: "Tienda", catalogLabel: "Productos y precios" },
  { value: "generic", label: "Otro negocio", catalogLabel: "Productos / servicios y precios" },
];

const languages = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const WEEK_DAYS: { key: WeekDay; label: string }[] = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const COMMON_TIMEZONES = [
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Mexico_City",
  "America/Lima",
  "America/Caracas",
  "America/Asuncion",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "America/New_York",
];

function emptyBusinessHours(): Record<WeekDay, BusinessHoursRange | null> {
  return {
    monday: null, tuesday: null, wednesday: null, thursday: null,
    friday: null, saturday: null, sunday: null,
  };
}

function hydrateBusinessHours(bh: BusinessHours | null | undefined): Record<WeekDay, BusinessHoursRange | null> {
  const base = emptyBusinessHours();
  if (!bh) return base;
  for (const d of WEEK_DAYS) {
    const v = bh[d.key];
    if (v && typeof v.open === "string" && typeof v.close === "string") {
      base[d.key] = { open: v.open, close: v.close };
    }
  }
  return base;
}

function hasAnyHours(bh: Record<WeekDay, BusinessHoursRange | null>): boolean {
  return WEEK_DAYS.some((d) => bh[d.key] !== null);
}

interface PlaygroundMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiAgentDetailPanel({ agent, onUpdated, onDeleted }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState(agent.name);

  // Business profile
  const [vertical, setVertical] = useState<BusinessVertical>(agent.config.businessProfile?.vertical ?? "generic");
  const [businessName, setBusinessName] = useState(agent.config.businessProfile?.businessName ?? "");
  const [description, setDescription] = useState(agent.config.businessProfile?.description ?? "");
  const [address, setAddress] = useState(agent.config.businessProfile?.address ?? "");
  const [paymentMethods, setPaymentMethods] = useState(agent.config.businessProfile?.paymentMethods ?? "");
  const [catalog, setCatalog] = useState<CatalogItem[]>(agent.config.businessProfile?.catalog ?? []);
  const [faqs, setFaqs] = useState<FaqEntry[]>(agent.config.businessProfile?.faqs ?? []);
  const [extraNotes, setExtraNotes] = useState(agent.config.businessProfile?.extraNotes ?? "");

  // Behavior
  const [language, setLanguage] = useState(agent.config.behavior?.language ?? "es");
  const [formality, setFormality] = useState<"informal" | "formal">(agent.config.behavior?.formality ?? "informal");
  const [useEmojis, setUseEmojis] = useState(agent.config.behavior?.useEmojis ?? true);
  const [goal, setGoal] = useState(agent.config.behavior?.goal ?? "");
  const [customInstructions, setCustomInstructions] = useState(agent.config.behavior?.customInstructions ?? "");

  // Advanced
  const [multiMessageEnabled, setMultiMessageEnabled] = useState(agent.config.multiMessage?.enabled ?? true);
  const [maxBubbles, setMaxBubbles] = useState(agent.config.multiMessage?.maxBubbles ?? 3);
  const [interBubbleDelay, setInterBubbleDelay] = useState(agent.config.multiMessage?.interBubbleDelayMs ?? 1200);
  const [debounceWindow, setDebounceWindow] = useState(agent.config.multiMessage?.debounceWindowMs ?? 2000);
  const [debounceMaxWait, setDebounceMaxWait] = useState(agent.config.multiMessage?.debounceMaxWaitMs ?? 20000);

  const [timezone, setTimezone] = useState(agent.config.timezone ?? "");
  const [hoursEnabled, setHoursEnabled] = useState(!!agent.config.businessHours && Object.values(agent.config.businessHours).some((v) => v != null));
  const [hours, setHours] = useState<Record<WeekDay, BusinessHoursRange | null>>(hydrateBusinessHours(agent.config.businessHours));

  // Playground
  const [chat, setChat] = useState<PlaygroundMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const selectedVertical = verticals.find((v) => v.value === vertical) ?? verticals[3];

  // Reset state when agent changes
  useEffect(() => {
    setName(agent.name);
    setVertical(agent.config.businessProfile?.vertical ?? "generic");
    setBusinessName(agent.config.businessProfile?.businessName ?? "");
    setDescription(agent.config.businessProfile?.description ?? "");
    setAddress(agent.config.businessProfile?.address ?? "");
    setPaymentMethods(agent.config.businessProfile?.paymentMethods ?? "");
    setCatalog(agent.config.businessProfile?.catalog ?? []);
    setFaqs(agent.config.businessProfile?.faqs ?? []);
    setExtraNotes(agent.config.businessProfile?.extraNotes ?? "");
    setLanguage(agent.config.behavior?.language ?? "es");
    setFormality(agent.config.behavior?.formality ?? "informal");
    setUseEmojis(agent.config.behavior?.useEmojis ?? true);
    setGoal(agent.config.behavior?.goal ?? "");
    setCustomInstructions(agent.config.behavior?.customInstructions ?? "");
    setMultiMessageEnabled(agent.config.multiMessage?.enabled ?? true);
    setMaxBubbles(agent.config.multiMessage?.maxBubbles ?? 3);
    setInterBubbleDelay(agent.config.multiMessage?.interBubbleDelayMs ?? 1200);
    setDebounceWindow(agent.config.multiMessage?.debounceWindowMs ?? 2000);
    setDebounceMaxWait(agent.config.multiMessage?.debounceMaxWaitMs ?? 20000);
    setTimezone(agent.config.timezone ?? "");
    setHoursEnabled(!!agent.config.businessHours && Object.values(agent.config.businessHours).some((v) => v != null));
    setHours(hydrateBusinessHours(agent.config.businessHours));
    setError(null);
    setSuccess(null);
    setChat([]);
    setChatInput("");
  }, [agent.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, any> = {
        name,
        businessProfile: {
          vertical,
          businessName,
          description,
          address,
          paymentMethods,
          catalog: catalog.filter((c) => c.name.trim().length > 0),
          faqs: faqs.filter((f) => f.question.trim().length > 0 && f.answer.trim().length > 0),
          extraNotes,
        },
        behavior: {
          language,
          formality,
          useEmojis,
          goal,
          customInstructions,
        },
        multiMessage: {
          enabled: multiMessageEnabled,
          maxBubbles,
          interBubbleDelayMs: interBubbleDelay,
          debounceWindowMs: debounceWindow,
          debounceMaxWaitMs: debounceMaxWait,
        },
      };

      payload.timezone = timezone.trim() ? timezone.trim() : null;
      if (hoursEnabled && hasAnyHours(hours)) {
        const bh: BusinessHours = {};
        for (const d of WEEK_DAYS) {
          bh[d.key] = hours[d.key];
        }
        payload.businessHours = bh;
      } else {
        payload.businessHours = null;
      }

      await api.patch(`/ai-agents/${agent.id}`, payload);
      setSuccess("Guardado");
      onUpdated();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Seguro que querés eliminar este asistente?")) return;

    try {
      await api.delete(`/ai-agents/${agent.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar");
    }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatting) return;

    const nextChat: PlaygroundMessage[] = [...chat, { role: "user", content: text }];
    setChat(nextChat);
    setChatInput("");
    setChatting(true);

    try {
      const result = await api.post<{ bubbles: string[]; tokensUsed: any }>(
        `/ai-agents/${agent.id}/playground`,
        { messages: nextChat }
      );
      const replies: PlaygroundMessage[] = result.bubbles
        .filter((b) => b.trim().length > 0)
        .map((b) => ({ role: "assistant" as const, content: b }));
      setChat((prev) => [...prev, ...replies]);
    } catch (err: any) {
      setChat((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${err.message}` }]);
    } finally {
      setChatting(false);
    }
  };

  const updateCatalogItem = (i: number, patch: Partial<CatalogItem>) => {
    setCatalog((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  };

  const updateFaq = (i: number, patch: Partial<FaqEntry>) => {
    setFaqs((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{agent.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[10px] h-5">
                {selectedVertical.label}
              </Badge>
              {businessName && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {businessName}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-4">
        <Tabs defaultValue="business" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="business" className="flex-1 text-xs">Negocio</TabsTrigger>
            <TabsTrigger value="catalog" className="flex-1 text-xs">Catálogo</TabsTrigger>
            <TabsTrigger value="faqs" className="flex-1 text-xs">Preguntas</TabsTrigger>
            <TabsTrigger value="behavior" className="flex-1 text-xs">Ajustes</TabsTrigger>
            <TabsTrigger value="playground" className="flex-1 text-xs">Probar</TabsTrigger>
          </TabsList>

          {/* ── Negocio ─────────────────────────────────────────── */}
          <TabsContent value="business" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre del asistente</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de negocio</label>
              <div className="grid grid-cols-2 gap-2">
                {verticals.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setVertical(v.value)}
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                      vertical === v.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre del negocio</label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">¿Qué hace tu negocio?</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Una frase: "Barbería clásica con cortes y afeitado"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Dirección</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Medios de pago</label>
              <Input
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder='"Efectivo, débito, Mercado Pago"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Otra información importante (opcional)</label>
              <Textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={4}
                placeholder="Cualquier dato extra que el asistente deba saber: promos, políticas de devolución, zonas de envío..."
              />
            </div>

            <hr className="my-1" />

            {/* Business hours */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Horario de atención</label>
                  <p className="text-xs text-muted-foreground">
                    Cuando está cerrado, el asistente avisa al cliente el horario de atención.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHoursEnabled(!hoursEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    hoursEnabled ? "bg-violet-600" : "bg-muted"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    hoursEnabled ? "translate-x-4" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {hoursEnabled && (
                <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Zona horaria (IANA)</label>
                    <Input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="America/Montevideo"
                      list="tz-suggestions"
                      className="text-sm"
                    />
                    <datalist id="tz-suggestions">
                      {COMMON_TIMEZONES.map((z) => (
                        <option key={z} value={z} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    {WEEK_DAYS.map((d) => {
                      const range = hours[d.key];
                      const isOpen = range !== null;
                      return (
                        <div key={d.key} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setHours((prev) => ({
                                ...prev,
                                [d.key]: isOpen ? null : { open: "09:00", close: "18:00" },
                              }));
                            }}
                            className={`w-20 shrink-0 rounded-md border px-2 py-1 text-xs text-left transition-colors ${
                              isOpen
                                ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                                : "text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            {d.label}
                          </button>
                          {isOpen ? (
                            <>
                              <Input
                                type="time"
                                value={range!.open}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setHours((prev) => ({
                                    ...prev,
                                    [d.key]: { open: v, close: prev[d.key]?.close ?? "18:00" },
                                  }));
                                }}
                                className="text-sm"
                              />
                              <span className="text-xs text-muted-foreground">a</span>
                              <Input
                                type="time"
                                value={range!.close}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setHours((prev) => ({
                                    ...prev,
                                    [d.key]: { open: prev[d.key]?.open ?? "09:00", close: v },
                                  }));
                                }}
                                className="text-sm"
                              />
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Cerrado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Si el cierre es anterior a la apertura (p. ej. 22:00 a 02:00), se interpreta como cruce de medianoche.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Catálogo ────────────────────────────────────────── */}
          <TabsContent value="catalog" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedVertical.catalogLabel}. El asistente solo informa lo que esté cargado acá — nunca inventa precios.
            </p>
            <div className="space-y-2">
              {catalog.map((item, i) => (
                <div key={i} className="rounded-lg border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateCatalogItem(i, { name: e.target.value })}
                      placeholder="Nombre"
                      className="flex-1"
                    />
                    <Input
                      value={item.price}
                      onChange={(e) => updateCatalogItem(i, { price: e.target.value })}
                      placeholder="$500"
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setCatalog((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Input
                    value={item.description}
                    onChange={(e) => updateCatalogItem(i, { description: e.target.value })}
                    placeholder="Detalle opcional (duración, qué incluye...)"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCatalog((prev) => [...prev, { name: "", price: "", description: "" }])}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </TabsContent>

          {/* ── Preguntas frecuentes ────────────────────────────── */}
          <TabsContent value="faqs" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Lo que te preguntan siempre, con la respuesta exacta que querés que dé. Es la mejor forma de mejorar al asistente.
            </p>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-lg border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, { question: e.target.value })}
                      placeholder='"¿Hacen envíos?"'
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(i, { answer: e.target.value })}
                    placeholder='"Sí, hacemos envíos a todo el país."'
                    rows={2}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </TabsContent>

          {/* ── Ajustes (comportamiento) ────────────────────────── */}
          <TabsContent value="behavior" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Idioma</label>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLanguage(l.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      language === l.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Trato</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "informal" as const, label: "Cercano (vos / tú)" },
                  { value: "formal" as const, label: "Formal (usted)" },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormality(f.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      formality === f.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Emojis</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: true, label: "Puede usar alguno" },
                  { value: false, label: "Sin emojis" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setUseEmojis(opt.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      useEmojis === opt.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Objetivo de la conversación</label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder="Ej: que junte los datos del pedido y avise que lo confirmamos enseguida."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Instrucciones extra (avanzado, opcional)</label>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
                placeholder="Reglas adicionales de comportamiento para el asistente."
              />
            </div>

            <hr className="my-1" />

            {/* Multi-Message / Natural Conversation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Conversación natural</label>
                  <p className="text-xs text-muted-foreground">Responde en varios mensajes cortos, como una persona</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMultiMessageEnabled(!multiMessageEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    multiMessageEnabled ? "bg-violet-600" : "bg-muted"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    multiMessageEnabled ? "translate-x-4" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {multiMessageEnabled && (
                <div className="space-y-2.5 rounded-lg border p-3 bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Máx. mensajes por respuesta</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={maxBubbles}
                        onChange={(e) => setMaxBubbles(Number(e.target.value))}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Pausa entre mensajes (ms)</label>
                      <Input
                        type="number"
                        min={0}
                        max={5000}
                        step={100}
                        value={interBubbleDelay}
                        onChange={(e) => setInterBubbleDelay(Number(e.target.value))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Espera por más mensajes (ms)</label>
                      <Input
                        type="number"
                        min={0}
                        max={10000}
                        step={500}
                        value={debounceWindow}
                        onChange={(e) => setDebounceWindow(Number(e.target.value))}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Espera máxima (ms)</label>
                      <Input
                        type="number"
                        min={0}
                        max={60000}
                        step={1000}
                        value={debounceMaxWait}
                        onChange={(e) => setDebounceMaxWait(Number(e.target.value))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Playground ──────────────────────────────────────── */}
          <TabsContent value="playground" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Hablá con tu asistente como si fueras un cliente. Usa exactamente la misma configuración que en WhatsApp.
              Guardá los cambios antes de probar.
            </p>
            <div className="rounded-lg border bg-muted/20 p-3 h-80 overflow-y-auto space-y-2">
              {chat.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-28">
                  Escribí un mensaje para empezar la prueba.
                </p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-violet-600 text-white"
                        : "bg-background border"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatting && (
                <div className="flex justify-start">
                  <div className="rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    escribiendo...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribí como un cliente..."
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
              />
              <Button onClick={handleChatSend} disabled={chatting || !chatInput.trim()} size="sm" className="gap-1 shrink-0">
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
            {chat.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChat([])}
              >
                Reiniciar conversación
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {(error || success) && (
          <div className={`mt-3 rounded-md px-3 py-2 text-sm ${
            error ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          }`}>
            {error || success}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1 bg-primary hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </>
  );
}
