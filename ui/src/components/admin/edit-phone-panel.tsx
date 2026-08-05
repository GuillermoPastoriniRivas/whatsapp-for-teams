"use client";

import { useState, useEffect } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { PhoneAccessSection } from "@/components/admin/phone-access-section";
import { useTranslations } from "@/lib/i18n/use-translations";
import { PROVIDER_CONFIG_FIELDS, type Provider } from "./providers";
import type { PhoneNumber } from "@/types";

interface Props {
  phone: PhoneNumber;
  onUpdated: () => void;
}

export function EditPhonePanel({ phone, onUpdated }: Props) {
  const { t } = useTranslations();
  const provider = phone.provider as Provider;
  const fields = PROVIDER_CONFIG_FIELDS[provider] ?? [];

  const [providerConfig, setProviderConfig] = useState<Record<string, string>>(phone.providerConfig ?? {});
  const [wabaId, setWabaId] = useState(phone.wabaId ?? "");
  const [portfolioId, setPortfolioId] = useState(phone.portfolioId ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(phone.phoneNumberId ?? "");
  const [displayPhone, setDisplayPhone] = useState(phone.displayPhone ?? "");
  const [label, setLabel] = useState(phone.label ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProviderConfig(phone.providerConfig ?? {});
    setWabaId(phone.wabaId ?? "");
    setPortfolioId(phone.portfolioId ?? "");
    setPhoneNumberId(phone.phoneNumberId ?? "");
    setDisplayPhone(phone.displayPhone ?? "");
    setLabel(phone.label ?? "");
    setWebhookSecret("");
    setError(null);
    setSuccess(null);
  }, [phone.id]);

  const handleConfigChange = (key: string, value: string) => {
    setProviderConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        providerConfig,
        wabaId,
        // Vacío se manda como null: así el backend vuelve a scopear por wabaId.
        portfolioId: portfolioId.trim() || null,
        phoneNumberId,
        displayPhone,
        label,
      };
      if (webhookSecret) body.webhookSecret = webhookSecret;

      await api.patch(`/phone-numbers/${phone.id}`, body);
      setSuccess(t.admin.saved);
      onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.admin.saveError;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const webhookHint =
    provider === "meta"
      ? t.admin.webhookHintMeta
      : provider === "kapso"
        ? t.admin.webhookHintKapso
        : t.admin.webhookHintDefault;

  return (
    <>
      {/* Header */}
      <div className="border-b px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Phone className="size-6" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{phone.label}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{phone.displayPhone}</span>
              <Badge variant="outline" className="capitalize">
                {phone.provider}
              </Badge>
              <StatusPill tone={phone.status === "active" ? "success" : "neutral"}>
                {phone.status === "active" ? t.admin.statusActive : t.admin.statusInactive}
              </StatusPill>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
        <PhoneAccessSection mode="phone" phoneId={phone.id} />

        <Field label={t.admin.provider}>
          <Input value={provider} disabled />
        </Field>

        <div className="space-y-3 rounded-xl border p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t.admin.providerConfig}
          </p>
          {fields.map((field) => (
            <Field key={field.key} label={field.label}>
              <Input
                value={providerConfig[field.key] || ""}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                placeholder={field.label}
              />
            </Field>
          ))}
        </div>

        <Field label="WABA ID">
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" />
        </Field>

        <Field label={t.admin.portfolioId} hint={t.admin.portfolioIdHint}>
          <Input
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
            placeholder={t.admin.portfolioIdPlaceholder}
          />
        </Field>

        <Field label="Phone Number ID">
          <Input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Phone Number ID"
          />
        </Field>

        <Field label={t.admin.displayPhone}>
          <Input
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder={t.admin.displayPhonePlaceholder}
          />
        </Field>

        <Field label={t.admin.phoneLabel}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.admin.phoneLabelPlaceholder}
          />
        </Field>

        <Field label={t.admin.webhookSecret} hint={webhookHint}>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={t.admin.webhookSecretKeep}
          />
        </Field>

        {error && <InlineNotice variant="error">{error}</InlineNotice>}
        {!error && success && <InlineNotice variant="success">{success}</InlineNotice>}

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Spinner size="sm" />}
            {loading ? t.common.saving : t.common.save}
          </Button>
        </div>
      </form>
    </>
  );
}
