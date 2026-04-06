"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api, ApiError } from "@/lib/api";

const PROVIDERS = ["openai", "anthropic", "custom"] as const;

interface StepAiProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StepAi({ onNext, onSkip }: StepAiProps) {
  const { t } = useTranslations();
  const [form, setForm] = useState({
    name: "",
    provider: "openai" as (typeof PROVIDERS)[number],
    model: "",
    apiKey: "",
    systemPrompt: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await api.post("/ai-agents", {
        name: form.name,
        provider: form.provider,
        model: form.model,
        apiKey: form.apiKey,
        ...(form.systemPrompt ? { systemPrompt: form.systemPrompt } : {}),
      });
      setCreated(true);
      setTimeout(() => onNext(), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear el agente IA");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t.onboarding.aiTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.onboarding.aiSubtitle}</p>
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
          <label className="text-xs text-muted-foreground">{t.onboarding.aiProvider}</label>
          <div className="flex gap-2 flex-wrap">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, provider: p })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.provider === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t.onboarding.aiModel}</label>
            <Input
              placeholder={t.onboarding.aiModelPlaceholder}
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t.onboarding.aiApiKey}</label>
            <Input
              type="password"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {t.onboarding.advancedOptions}
        </button>

        {showAdvanced && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t.onboarding.aiSystemPrompt}</label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t.onboarding.aiSystemPromptPlaceholder}
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            />
          </div>
        )}
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
          disabled={isLoading || !form.name || !form.model || !form.apiKey}
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
