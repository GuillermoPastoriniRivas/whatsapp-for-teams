"use client";

import { useState } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import { PROVIDER_CONFIG_FIELDS, PROVIDER_LABELS, PROVIDERS, type Provider } from "./providers";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function RegisterPhonePanel({ onCreated, onCancel }: Props) {
  const { t } = useTranslations();
  const [provider, setProvider] = useState<Provider>("meta");
  const [providerConfig, setProviderConfig] = useState<Record<string, string>>({});
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [label, setLabel] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setProviderConfig({});
  };

  const handleConfigChange = (key: string, value: string) => {
    setProviderConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/phone-numbers", {
        provider,
        providerConfig,
        wabaId,
        phoneNumberId,
        displayPhone,
        label,
        webhookSecret,
      });
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.admin.registerError;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="border-b px-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Phone className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t.admin.registerPhone}</h2>
            <p className="text-xs text-muted-foreground">{t.admin.registerPhoneSubtitle}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
        <Field label={t.admin.provider}>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={provider === p}
                onClick={() => handleProviderChange(p)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition-colors",
                  provider === p ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                )}
              >
                {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-3 rounded-xl border p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t.admin.providerConfig}
          </p>
          {PROVIDER_CONFIG_FIELDS[provider].map((field) => (
            <Field key={field.key} label={field.label} required>
              <Input
                value={providerConfig[field.key] || ""}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                placeholder={field.label}
                required
              />
            </Field>
          ))}
        </div>

        <Field label="WABA ID" required>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" required />
        </Field>

        <Field label="Phone Number ID" required>
          <Input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Phone Number ID"
            required
          />
        </Field>

        <Field label={t.admin.displayPhone} required>
          <Input
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder={t.admin.displayPhonePlaceholder}
            required
          />
        </Field>

        <Field label={t.admin.phoneLabel} required>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.admin.phoneLabelPlaceholder}
            required
          />
        </Field>

        <Field label={t.admin.webhookSecret}>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={t.admin.webhookSecret}
          />
        </Field>

        {error && <InlineNotice variant="error">{error}</InlineNotice>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <div className="flex-1" />
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Spinner size="sm" />}
            {loading ? t.admin.registering : t.admin.register}
          </Button>
        </div>
      </form>
    </>
  );
}
