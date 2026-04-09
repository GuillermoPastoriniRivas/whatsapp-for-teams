"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Phone, Save, ShoppingBag } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { usePluginStore } from "@/stores/plugin.store";
import type { PhoneNumber } from "@/types";

type Provider = "meta" | "twilio" | "360dialog" | "kapso";

const providerConfigFields: Record<Provider, { key: string; label: string }[]> = {
  meta: [{ key: "accessToken", label: "Access Token" }],
  twilio: [
    { key: "accountSid", label: "Account SID" },
    { key: "authToken", label: "Auth Token" },
    { key: "fromNumber", label: "From Number" },
  ],
  "360dialog": [{ key: "apiKey", label: "API Key" }],
  kapso: [{ key: "apiKey", label: "API Key" }],
};

interface Props {
  phone: PhoneNumber;
  onUpdated: () => void;
}

export function EditPhonePanel({ phone, onUpdated }: Props) {
  const provider = phone.provider as Provider;
  const fields = providerConfigFields[provider] ?? [];
  const { t } = useTranslations();

  const [providerConfig, setProviderConfig] = useState<Record<string, string>>(phone.providerConfig ?? {});
  const [wabaId, setWabaId] = useState(phone.wabaId ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(phone.phoneNumberId ?? "");
  const [displayPhone, setDisplayPhone] = useState(phone.displayPhone ?? "");
  const [label, setLabel] = useState(phone.label ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [plugins, setPlugins] = useState<string[]>(phone.plugins ?? []);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProviderConfig(phone.providerConfig ?? {});
    setWabaId(phone.wabaId ?? "");
    setPhoneNumberId(phone.phoneNumberId ?? "");
    setDisplayPhone(phone.displayPhone ?? "");
    setLabel(phone.label ?? "");
    setWebhookSecret("");
    setPlugins(phone.plugins ?? []);
    setError(null);
    setSuccess(null);
  }, [phone.id]);

  const togglePlugin = (plugin: string) => {
    setPlugins((prev) =>
      prev.includes(plugin) ? prev.filter((p) => p !== plugin) : [...prev, plugin]
    );
  };

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
        phoneNumberId,
        displayPhone,
        label,
        plugins,
      };
      if (webhookSecret) body.webhookSecret = webhookSecret;

      await api.patch(`/phone-numbers/${phone.id}`, body);
      setSuccess("Saved successfully");
      onUpdated();
      // Reload active plugins so sidebar reflects changes immediately
      usePluginStore.getState().load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Phone className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{phone.label}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">{phone.displayPhone}</span>
              <Badge variant="outline" className="capitalize text-[10px] h-5">{phone.provider}</Badge>
              <Badge
                variant={phone.status === "active" ? "default" : "secondary"}
                className="capitalize text-[10px] h-5"
              >
                {phone.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Provider</label>
          <Input value={provider} disabled className="bg-muted" />
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Provider Config
          </p>
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium">{field.label}</label>
              <Input
                value={providerConfig[field.key] || ""}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                placeholder={field.label}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">WABA ID</label>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Phone Number ID</label>
          <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Display Phone</label>
          <Input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} placeholder="+1 234 567 8900" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Label</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Business Phone" />
        </div>

        {/* Plugins */}
        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t.admin.plugins}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.admin.pluginsDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={() => togglePlugin("orders")}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
              plugins.includes("orders")
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              plugins.includes("orders")
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}>
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.admin.pluginOrders}</p>
              <p className="text-xs text-muted-foreground">{t.admin.pluginOrdersDescription}</p>
            </div>
            <div className={cn(
              "h-5 w-9 rounded-full transition-colors relative shrink-0",
              plugins.includes("orders") ? "bg-primary" : "bg-muted-foreground/30"
            )}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                plugins.includes("orders") ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Webhook Secret</label>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Leave empty to keep current"
          />
          <p className="text-xs text-muted-foreground">
            {provider === "meta" ? "Meta App Secret — found in Meta Developers > App Settings > Basic" : provider === "kapso" ? "Not required for Kapso Meta webhook forwarding" : "Webhook secret for signature validation"}
          </p>
        </div>

        {(error || success) && (
          <div className={`rounded-md px-3 py-2 text-sm ${
            error ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          }`}>
            {error || success}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="gap-1 bg-primary hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </>
  );
}
