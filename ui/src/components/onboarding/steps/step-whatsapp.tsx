"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api, ApiError } from "@/lib/api";

const WEBHOOK_URL = "https://api.asis.chat/webhooks/whatsapp";

type Mode = "select" | "credentials" | "guide";

interface StepWhatsappProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StepWhatsapp({ onNext, onSkip }: StepWhatsappProps) {
  const { t } = useTranslations();
  const [mode, setMode] = useState<Mode>("select");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const [form, setForm] = useState({
    provider: "meta",
    accessToken: "",
    wabaId: "",
    phoneNumberId: "",
    displayPhone: "",
    label: "",
    webhookSecret: "",
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await api.post("/phone-numbers", {
        provider: form.provider,
        providerConfig: { accessToken: form.accessToken },
        wabaId: form.wabaId,
        phoneNumberId: form.phoneNumberId,
        displayPhone: form.displayPhone,
        label: form.label,
        webhookSecret: form.webhookSecret,
      });
      setConnected(true);
      setTimeout(() => onNext(), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al conectar el número");
    } finally {
      setIsLoading(false);
    }
  };

  const credentialsForm = (
    <div className="w-full space-y-3 mt-4">
      <p className="text-sm font-medium text-foreground">{t.onboarding.credentialsTitle}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.accessToken}</label>
          <Input
            placeholder="EAAGm..."
            value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.wabaId}</label>
          <Input
            placeholder="123456789"
            value={form.wabaId}
            onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.phoneNumberId}</label>
          <Input
            placeholder="987654321"
            value={form.phoneNumberId}
            onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.displayPhone}</label>
          <Input
            placeholder="+54 11 1234-5678"
            value={form.displayPhone}
            onChange={(e) => setForm({ ...form, displayPhone: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.label}</label>
          <Input
            placeholder="Ventas"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">{t.onboarding.webhookSecret}</label>
          <Input
            placeholder="mi-secreto-seguro"
            value={form.webhookSecret}
            onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {connected ? (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          {t.onboarding.phoneConnectedSuccess}
        </div>
      ) : (
        <Button
          className="w-full rounded-xl"
          onClick={handleConnect}
          disabled={isLoading || !form.accessToken || !form.wabaId || !form.phoneNumberId || !form.displayPhone || !form.label || !form.webhookSecret}
        >
          {isLoading ? t.onboarding.connecting : t.onboarding.connectNumber}
        </Button>
      )}
    </div>
  );

  if (mode === "select") {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{t.onboarding.whatsappTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.onboarding.whatsappSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => setMode("credentials")}
            className="flex flex-col gap-1.5 rounded-xl border-2 border-primary p-4 text-left transition-colors hover:bg-primary/5"
          >
            <span className="text-sm font-semibold">{t.onboarding.haveCredentials}</span>
            <span className="text-xs text-muted-foreground">{t.onboarding.haveCredentialsDesc}</span>
          </button>
          <button
            onClick={() => setMode("guide")}
            className="flex flex-col gap-1.5 rounded-xl border-2 border-border p-4 text-left transition-colors hover:bg-muted/50"
          >
            <span className="text-sm font-semibold">{t.onboarding.needHelp}</span>
            <span className="text-xs text-muted-foreground">{t.onboarding.needHelpDesc}</span>
          </button>
        </div>

        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline self-center"
        >
          {t.onboarding.skipForNow}
        </button>
      </div>
    );
  }

  if (mode === "credentials") {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setMode("select")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground self-start"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.onboarding.back}
        </button>
        <div>
          <h2 className="text-2xl font-bold">{t.onboarding.whatsappTitle}</h2>
        </div>
        {credentialsForm}
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline self-center"
        >
          {t.onboarding.skipForNow}
        </button>
      </div>
    );
  }

  // guide mode
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setMode("select")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground self-start"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.onboarding.back}
      </button>
      <div>
        <h2 className="text-2xl font-bold">{t.onboarding.whatsappTitle}</h2>
      </div>

      <ol className="space-y-3">
        {[
          { text: t.onboarding.guideStep1, link: "https://developers.facebook.com/apps" },
          { text: t.onboarding.guideStep2, link: null },
          { text: t.onboarding.guideStep3, link: null },
          { text: t.onboarding.guideStep4, link: null, webhook: true },
          { text: t.onboarding.guideStep5, link: null },
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {i + 1}
            </span>
            <div className="flex-1 space-y-2">
              <span className="text-sm">
                {step.text}
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Meta Developers <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
              {step.webhook && (
                <div className="flex gap-2">
                  <Input readOnly value={WEBHOOK_URL} className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {credentialsForm}

      <button
        onClick={onSkip}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline self-center"
      >
        {t.onboarding.skipForNow}
      </button>
    </div>
  );
}
