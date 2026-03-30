"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { PhoneNumber } from "@/types";

type Provider = "meta" | "twilio" | "360dialog";

const providerConfigFields: Record<Provider, { key: string; label: string; type?: string }[]> = {
  meta: [{ key: "accessToken", label: "Access Token" }],
  twilio: [
    { key: "accountSid", label: "Account SID" },
    { key: "authToken", label: "Auth Token" },
    { key: "fromNumber", label: "From Number" },
  ],
  "360dialog": [{ key: "apiKey", label: "API Key" }],
};

interface Props {
  phone: PhoneNumber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditPhoneForm({ phone, open, onOpenChange, onUpdated }: Props) {
  const [providerConfig, setProviderConfig] = useState<Record<string, string>>({});
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [label, setLabel] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (phone) {
      setProviderConfig(phone.providerConfig ?? {});
      setWabaId(phone.wabaId ?? "");
      setPhoneNumberId(phone.phoneNumberId ?? "");
      setDisplayPhone(phone.displayPhone ?? "");
      setLabel(phone.label ?? "");
      setWebhookSecret("");
    }
  }, [phone]);

  if (!phone) return null;

  const provider = phone.provider as Provider;
  const fields = providerConfigFields[provider] ?? [];

  const handleConfigChange = (key: string, value: string) => {
    setProviderConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        providerConfig,
        wabaId,
        phoneNumberId,
        displayPhone,
        label,
      };
      if (webhookSecret) body.webhookSecret = webhookSecret;

      await api.patch(`/phone-numbers/${phone.id}`, body);
      onUpdated();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update phone number";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Phone Number</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Provider</label>
            <Input value={provider} disabled className="bg-muted" />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Provider Config
            </p>
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{field.label}</label>
                <Input
                  type={field.type || "text"}
                  value={providerConfig[field.key] || ""}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">WABA ID</label>
            <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Phone Number ID</label>
            <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Display Phone</label>
            <Input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} placeholder="+1 234 567 8900" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Business Phone" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Webhook Secret (App Secret)</label>
            <Input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Leave empty to keep current"
            />
            <p className="text-xs text-muted-foreground">
              {provider === "meta" ? "Meta App Secret — found in Meta Developers > App Settings > Basic" : "Webhook secret for signature validation"}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
