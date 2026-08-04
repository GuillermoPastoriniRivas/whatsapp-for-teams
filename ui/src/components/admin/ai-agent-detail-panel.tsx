"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, Plus, Send, Trash2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import { AI_LANGUAGES, useVerticals } from "./verticals";
import type {
  AiAgentWithConfig, BusinessHours, BusinessHoursRange, WeekDay,
  BusinessVertical, CatalogItem, FaqEntry,
} from "@/types";

interface Props {
  agent: AiAgentWithConfig;
  onUpdated: () => void;
  onDeleted: () => void;
}

const WEEK_DAYS: WeekDay[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
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
  for (const day of WEEK_DAYS) {
    const v = bh[day];
    if (v && typeof v.open === "string" && typeof v.close === "string") {
      base[day] = { open: v.open, close: v.close };
    }
  }
  return base;
}

function hasAnyHours(bh: Record<WeekDay, BusinessHoursRange | null>): boolean {
  return WEEK_DAYS.some((day) => bh[day] !== null);
}

interface PlaygroundMessage {
  role: "user" | "assistant";
  content: string;
}

/** Interruptor de la app: no hay `Switch` en el sistema todavía. */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

/** Chip seleccionable: idioma, trato, emojis. */
function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs transition-colors",
        selected ? "border-primary bg-primary/10" : "hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}

export function AiAgentDetailPanel({ agent, onUpdated, onDeleted }: Props) {
  const { t } = useTranslations();
  const confirm = useConfirm();
  const verticals = useVerticals();

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

  const dayLabels: Record<WeekDay, string> = {
    monday: t.agents.monday,
    tuesday: t.agents.tuesday,
    wednesday: t.agents.wednesday,
    thursday: t.agents.thursday,
    friday: t.agents.friday,
    saturday: t.agents.saturday,
    sunday: t.agents.sunday,
  };

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
        for (const day of WEEK_DAYS) {
          bh[day] = hours[day];
        }
        payload.businessHours = bh;
      } else {
        payload.businessHours = null;
      }

      await api.patch(`/ai-agents/${agent.id}`, payload);
      setSuccess(t.agents.aiSaved);
      onUpdated();
    } catch (err: any) {
      setError(err.message || t.agents.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t.agents.confirmDeleteAi,
      confirmLabel: t.common.delete,
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/ai-agents/${agent.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.message || t.agents.deleteError);
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
      setChat((prev) => [...prev, { role: "assistant", content: `⚠️ ${err.message}` }]);
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
      <div className="border-b px-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{agent.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{selectedVertical.label}</Badge>
              {businessName && <Badge variant="secondary">{businessName}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-4">
        <Tabs defaultValue="business" className="w-full gap-0">
          <TabsList className="scrollbar-hide w-full justify-start overflow-x-auto">
            <TabsTrigger value="business">{t.agents.tabBusiness}</TabsTrigger>
            <TabsTrigger value="catalog">{t.agents.tabCatalog}</TabsTrigger>
            <TabsTrigger value="faqs">{t.agents.tabFaqs}</TabsTrigger>
            <TabsTrigger value="behavior">{t.agents.tabBehavior}</TabsTrigger>
            <TabsTrigger value="playground">{t.agents.tabPlayground}</TabsTrigger>
          </TabsList>

          {/* ── Negocio ─────────────────────────────────────────── */}
          <TabsContent value="business" className="mt-4 space-y-4">
            <Field label={t.agents.aiName}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t.agents.businessType}>
              <div role="radiogroup" className="grid grid-cols-2 gap-2">
                {verticals.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="radio"
                    aria-checked={vertical === v.value}
                    onClick={() => setVertical(v.value)}
                    className={cn(
                      "rounded-xl border p-2 text-left text-xs transition-colors",
                      vertical === v.value ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t.agents.businessName}>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </Field>
            <Field label={t.agents.businessDescriptionShort}>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.agents.businessDescriptionShortPlaceholder}
              />
            </Field>
            <Field label={t.agents.address}>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label={t.agents.paymentMethods}>
              <Input
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder={t.agents.paymentMethodsShortPlaceholder}
              />
            </Field>
            <Field label={t.agents.extraNotes}>
              <Textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={4}
                placeholder={t.agents.extraNotesPlaceholder}
              />
            </Field>

            <Separator />

            {/* Business hours */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.agents.businessHours}</p>
                  <p className="text-xs text-muted-foreground">{t.agents.businessHoursHint}</p>
                </div>
                <Toggle
                  checked={hoursEnabled}
                  onChange={() => setHoursEnabled(!hoursEnabled)}
                  label={t.agents.businessHours}
                />
              </div>

              {hoursEnabled && (
                <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                  <Field label={t.agents.timezone}>
                    <Input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="America/Montevideo"
                      list="tz-suggestions"
                    />
                  </Field>
                  <datalist id="tz-suggestions">
                    {COMMON_TIMEZONES.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>

                  <div className="space-y-1.5">
                    {WEEK_DAYS.map((day) => {
                      const range = hours[day];
                      const isOpen = range !== null;
                      return (
                        <div key={day} className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-pressed={isOpen}
                            onClick={() => {
                              setHours((prev) => ({
                                ...prev,
                                [day]: isOpen ? null : { open: "09:00", close: "18:00" },
                              }));
                            }}
                            className={cn(
                              "w-20 shrink-0 rounded-md border px-2 py-1 text-left text-xs transition-colors",
                              isOpen
                                ? "border-primary bg-primary/10"
                                : "text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            {dayLabels[day]}
                          </button>
                          {isOpen ? (
                            <>
                              <Input
                                type="time"
                                aria-label={dayLabels[day]}
                                value={range.open}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setHours((prev) => ({
                                    ...prev,
                                    [day]: { open: v, close: prev[day]?.close ?? "18:00" },
                                  }));
                                }}
                              />
                              <span className="text-xs text-muted-foreground">{t.agents.hoursTo}</span>
                              <Input
                                type="time"
                                aria-label={dayLabels[day]}
                                value={range.close}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setHours((prev) => ({
                                    ...prev,
                                    [day]: { open: prev[day]?.open ?? "09:00", close: v },
                                  }));
                                }}
                              />
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t.agents.closed}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.agents.businessHoursOvernight}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Catálogo ────────────────────────────────────────── */}
          <TabsContent value="catalog" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedVertical.catalogLabel}. {t.agents.catalogDetailHint}
            </p>
            <div className="space-y-2">
              {catalog.map((item, i) => (
                <div key={i} className="space-y-2 rounded-xl border p-2">
                  <div className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateCatalogItem(i, { name: e.target.value })}
                      placeholder={t.agents.itemName}
                      className="flex-1"
                    />
                    <Input
                      value={item.price}
                      onChange={(e) => updateCatalogItem(i, { price: e.target.value })}
                      placeholder={t.agents.itemPricePlaceholder}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.common.delete}
                      onClick={() => setCatalog((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Input
                    value={item.description}
                    onChange={(e) => updateCatalogItem(i, { description: e.target.value })}
                    placeholder={t.agents.itemDetailPlaceholder}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCatalog((prev) => [...prev, { name: "", price: "", description: "" }])}
            >
              <Plus className="size-4" />
              {t.agents.add}
            </Button>
          </TabsContent>

          {/* ── Preguntas frecuentes ────────────────────────────── */}
          <TabsContent value="faqs" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{t.agents.faqsDetailHint}</p>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="space-y-2 rounded-xl border p-2">
                  <div className="flex gap-2">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, { question: e.target.value })}
                      placeholder={t.agents.faqQuestionShortPlaceholder}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.common.delete}
                      onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(i, { answer: e.target.value })}
                    placeholder={t.agents.faqAnswerShortPlaceholder}
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
            >
              <Plus className="size-4" />
              {t.agents.add}
            </Button>
          </TabsContent>

          {/* ── Ajustes (comportamiento) ────────────────────────── */}
          <TabsContent value="behavior" className="mt-4 space-y-4">
            <Field label={t.agents.language}>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {AI_LANGUAGES.map((l) => (
                  <ChoiceChip key={l.value} selected={language === l.value} onClick={() => setLanguage(l.value)}>
                    {l.label}
                  </ChoiceChip>
                ))}
              </div>
            </Field>
            <Field label={t.agents.formality}>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {[
                  { value: "informal" as const, label: t.agents.formalityInformal },
                  { value: "formal" as const, label: t.agents.formalityFormal },
                ].map((f) => (
                  <ChoiceChip key={f.value} selected={formality === f.value} onClick={() => setFormality(f.value)}>
                    {f.label}
                  </ChoiceChip>
                ))}
              </div>
            </Field>
            <Field label={t.agents.emojis}>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {[
                  { value: true, label: t.agents.emojisOn },
                  { value: false, label: t.agents.emojisOff },
                ].map((opt) => (
                  <ChoiceChip
                    key={String(opt.value)}
                    selected={useEmojis === opt.value}
                    onClick={() => setUseEmojis(opt.value)}
                  >
                    {opt.label}
                  </ChoiceChip>
                ))}
              </div>
            </Field>
            <Field label={t.agents.goal}>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder={t.agents.goalPlaceholder}
              />
            </Field>
            <Field label={t.agents.customInstructions}>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
                placeholder={t.agents.customInstructionsPlaceholder}
              />
            </Field>

            <Separator />

            {/* Multi-Message / Natural Conversation */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.agents.multiMessage}</p>
                  <p className="text-xs text-muted-foreground">{t.agents.multiMessageHint}</p>
                </div>
                <Toggle
                  checked={multiMessageEnabled}
                  onChange={() => setMultiMessageEnabled(!multiMessageEnabled)}
                  label={t.agents.multiMessage}
                />
              </div>

              {multiMessageEnabled && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2">
                  <Field label={t.agents.maxBubbles}>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxBubbles}
                      onChange={(e) => setMaxBubbles(Number(e.target.value))}
                    />
                  </Field>
                  <Field label={t.agents.interBubbleDelay}>
                    <Input
                      type="number"
                      min={0}
                      max={5000}
                      step={100}
                      value={interBubbleDelay}
                      onChange={(e) => setInterBubbleDelay(Number(e.target.value))}
                    />
                  </Field>
                  <Field label={t.agents.debounceWindow}>
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      step={500}
                      value={debounceWindow}
                      onChange={(e) => setDebounceWindow(Number(e.target.value))}
                    />
                  </Field>
                  <Field label={t.agents.debounceMaxWait}>
                    <Input
                      type="number"
                      min={0}
                      max={60000}
                      step={1000}
                      value={debounceMaxWait}
                      onChange={(e) => setDebounceMaxWait(Number(e.target.value))}
                    />
                  </Field>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Playground ──────────────────────────────────────── */}
          <TabsContent value="playground" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{t.agents.playgroundHint}</p>
            <div className="h-80 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-3">
              {chat.length === 0 && (
                <p className="pt-28 text-center text-xs text-muted-foreground">
                  {t.agents.playgroundEmpty}
                </p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border bg-background"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatting && (
                <div className="flex justify-start">
                  <div className="rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    {t.agents.playgroundTyping}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t.agents.playgroundPlaceholder}
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
              />
              <Button onClick={handleChatSend} disabled={chatting || !chatInput.trim()} size="sm" className="shrink-0">
                <Send className="size-4" />
                {t.agents.playgroundSend}
              </Button>
            </div>
            {chat.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setChat([])}>
                {t.agents.playgroundReset}
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {error && <InlineNotice variant="error" className="mt-3">{error}</InlineNotice>}
        {!error && success && <InlineNotice variant="success" className="mt-3">{success}</InlineNotice>}

        <div className="mt-4 flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" />
            {t.common.delete}
          </Button>
          <div className="flex-1" />
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving && <Spinner size="sm" />}
            {saving ? t.common.saving : t.common.save}
          </Button>
        </div>
      </div>
    </>
  );
}
