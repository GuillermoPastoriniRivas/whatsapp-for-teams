"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api, ApiError } from "@/lib/api";
import type { BusinessVertical } from "@/types";

const VERTICALS: { value: BusinessVertical; label: string }[] = [
  { value: "beauty", label: "Estética y belleza" },
  { value: "food", label: "Gastronomía" },
  { value: "retail", label: "Tienda" },
  { value: "generic", label: "Otro" },
];

interface StepAiProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StepAi({ onNext, onSkip }: StepAiProps) {
  const { t } = useTranslations();
  const [form, setForm] = useState({
    name: "",
    vertical: "beauty" as BusinessVertical,
    businessName: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await api.post("/ai-agents", {
        name: form.name,
        businessProfile: {
          vertical: form.vertical,
          businessName: form.businessName,
        },
        handoffRules: { onCustomerRequest: true, maxConsecutiveFailures: 3 },
      });
      setCreated(true);
      setTimeout(() => onNext(), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear el asistente");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t.onboarding.aiTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Contanos lo básico y creamos tu asistente. Después lo completás con tus precios y preguntas frecuentes.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.aiName}</label>
          <Input
            placeholder={t.onboarding.aiNamePlaceholder}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo de negocio</label>
          <div className="flex gap-2 flex-wrap">
            {VERTICALS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setForm({ ...form, vertical: v.value })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.vertical === v.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nombre del negocio</label>
          <Input
            placeholder='Ej: "Barbería Don Pedro"'
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {created ? (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          {t.onboarding.aiCreatedSuccess}
        </div>
      ) : (
        <Button
          className="w-full rounded-xl h-11"
          onClick={handleCreate}
          disabled={isLoading || !form.name || !form.businessName}
        >
          {isLoading ? t.onboarding.creating : t.onboarding.createAiAgent}
        </Button>
      )}

      <button
        onClick={onSkip}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline self-center"
      >
        {t.onboarding.skip}
      </button>
    </div>
  );
}
