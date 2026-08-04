"use client";

import { useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import { AI_LANGUAGES, useVerticals } from "./verticals";
import type { BusinessVertical, CatalogItem, FaqEntry } from "@/types";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

const TOTAL_STEPS = 5;

/** Chip seleccionable: idioma, trato, emojis, rubro. */
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

export function CreateAiAgentPanel({ onCreated, onCancel }: Props) {
  const { t } = useTranslations();
  const verticals = useVerticals();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<BusinessVertical>("beauty");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethods, setPaymentMethods] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([{ name: "", price: "", description: "" }]);
  const [faqs, setFaqs] = useState<FaqEntry[]>([{ question: "", answer: "" }]);
  const [language, setLanguage] = useState("es");
  const [formality, setFormality] = useState<"informal" | "formal">("informal");
  const [useEmojis, setUseEmojis] = useState(true);
  const [goal, setGoal] = useState("");

  const selectedVertical = verticals.find((v) => v.value === vertical)!;

  const goalTemplates = [
    { label: t.agents.goalBooking, text: t.agents.goalBookingText },
    { label: t.agents.goalOrders, text: t.agents.goalOrdersText },
    { label: t.agents.goalLeads, text: t.agents.goalLeadsText },
  ];

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      await api.post("/ai-agents", {
        name,
        businessProfile: {
          vertical,
          businessName,
          description,
          address,
          paymentMethods,
          catalog: catalog.filter((c) => c.name.trim().length > 0),
          faqs: faqs.filter((f) => f.question.trim().length > 0 && f.answer.trim().length > 0),
          extraNotes: "",
        },
        behavior: {
          language,
          formality,
          useEmojis,
          goal,
          customInstructions: "",
        },
        handoffRules: { onCustomerRequest: true, maxConsecutiveFailures: 3 },
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || t.agents.createAiError);
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return businessName.trim().length > 0;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
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
      <div className="px-4 pt-6 pb-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t.agents.newAiAgent}</h2>
            <p className="text-xs text-muted-foreground">
              {t.agents.stepLabel} {step} {t.agents.stepOf} {TOTAL_STEPS}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn("h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 px-4 pb-4">
        {step === 1 && (
          <>
            <h3 className="text-sm font-semibold">{t.agents.stepBusinessType}</h3>
            <div role="radiogroup" className="grid grid-cols-1 gap-2">
              {verticals.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={vertical === v.value}
                  onClick={() => setVertical(v.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    vertical === v.value ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <p className="text-xs text-muted-foreground">{v.hint}</p>
                </button>
              ))}
            </div>
            <Field label={t.agents.aiName} hint={t.agents.aiNameHint}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.agents.aiNamePlaceholder}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="text-sm font-semibold">{t.agents.stepBusinessData}</h3>
            <Field label={t.agents.businessName}>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t.agents.businessNamePlaceholder}
              />
            </Field>
            <Field label={t.agents.businessDescription}>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.agents.businessDescriptionPlaceholder}
              />
            </Field>
            <Field label={t.agents.addressOptional}>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t.agents.addressPlaceholder}
              />
            </Field>
            <Field label={t.agents.paymentMethodsOptional}>
              <Input
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder={t.agents.paymentMethodsPlaceholder}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="text-sm font-semibold">{selectedVertical.catalogLabel}</h3>
            <p className="text-sm text-muted-foreground">{t.agents.catalogHint}</p>
            <div className="space-y-2">
              {catalog.map((item, i) => (
                <div key={i} className="space-y-2 rounded-xl border p-2">
                  <div className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateCatalogItem(i, { name: e.target.value })}
                      placeholder={selectedVertical.itemPlaceholder}
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
                      disabled={catalog.length === 1}
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
              {t.agents.addAnother}
            </Button>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="text-sm font-semibold">{t.agents.faqs}</h3>
            <p className="text-sm text-muted-foreground">{t.agents.faqsHint}</p>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="space-y-2 rounded-xl border p-2">
                  <div className="flex gap-2">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, { question: e.target.value })}
                      placeholder={t.agents.faqQuestionPlaceholder}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.common.delete}
                      onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={faqs.length === 1}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(i, { answer: e.target.value })}
                    placeholder={t.agents.faqAnswerPlaceholder}
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
              {t.agents.addAnotherFaq}
            </Button>
          </>
        )}

        {step === 5 && (
          <>
            <h3 className="text-sm font-semibold">{t.agents.stepStyle}</h3>
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
            <Field label={t.agents.goalOptional}>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t.agents.goalPlaceholder}
                rows={3}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {goalTemplates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => setGoal(template.text)}
                  className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/50"
                >
                  + {template.label}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <InlineNotice variant="error">{error}</InlineNotice>}

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          {step > 1 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="size-4" />
              {t.agents.back}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {t.common.cancel}
            </Button>
          )}
          <div className="flex-1" />
          {step < TOTAL_STEPS ? (
            <Button type="button" size="sm" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              {t.common.next}
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleSubmit} disabled={loading}>
              {loading && <Spinner size="sm" />}
              {loading ? t.agents.creatingAi : t.agents.createAi}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
