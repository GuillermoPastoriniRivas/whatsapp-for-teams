"use client";

import { useState, useEffect } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneProfileForm } from "@/components/admin/phone-profile-form";
import { PhoneChatForm } from "@/components/admin/phone-chat-form";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { PhoneAccessSection } from "@/components/admin/phone-access-section";
import { WhoAnswersSection } from "@/components/admin/who-answers-section";
import { useTranslations } from "@/lib/i18n/use-translations";
import { toast } from "@/lib/toast";
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

  const webhookHint = provider === "meta" ? t.admin.webhookHintMeta : t.admin.webhookHintDefault;

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

      {/* El perfil es lo que ve el cliente; la conexión es plumbing del admin.
          Van separados para que uno no tenga que pasar por el otro. */}
      <Tabs defaultValue="profile" className="gap-0">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="profile">{t.admin.tabProfile}</TabsTrigger>
          <TabsTrigger value="chat">{t.admin.tabAutomation}</TabsTrigger>
          <TabsTrigger value="connection">{t.admin.tabConnection}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <PhoneProfileForm phone={phone} onUpdated={onUpdated} />
        </TabsContent>

        <TabsContent value="chat">
          <PhoneChatForm phone={phone} onUpdated={onUpdated} />
        </TabsContent>

        <TabsContent value="connection">
          <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
            {/* Quién atiende va primero: es la pregunta que trae a esta
                pantalla. Los permisos de abajo dicen quién puede ver el
                número, no quién contesta. */}
            <WhoAnswersSection phoneId={phone.id} />

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

          {/* Va fuera del <form> de arriba: es otra acción contra Meta, no una
              edición de las credenciales guardadas. */}
          <div className="border-t px-4 py-4">
            <RegisterOnMetaSection phoneId={phone.id} onUpdated={onUpdated} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Registro del número en Cloud API con el PIN de verificación en dos pasos.
 *
 * Es el paso que faltaba en el alta: sin él el número no manda nada, por más
 * que las credenciales estén bien.
 */
function RegisterOnMetaSection({ phoneId, onUpdated }: { phoneId: string; onUpdated: () => void }) {
  const { t } = useTranslations();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const register = async () => {
    setBusy(true);
    try {
      await api.post(`/phone-numbers/${phoneId}/register`, { pin });
      setPin("");
      toast.success(t.admin.registered);
      onUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.admin.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.admin.registerTitle}</p>
      <p className="text-xs text-muted-foreground">{t.admin.registerHint}</p>
      <div className="flex items-center gap-2">
        <Input
          value={pin}
          inputMode="numeric"
          maxLength={6}
          placeholder={t.admin.registerPin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <Button type="button" variant="outline" disabled={busy || pin.length !== 6} onClick={register}>
          {t.admin.registerAction}
        </Button>
      </div>
    </div>
  );
}
