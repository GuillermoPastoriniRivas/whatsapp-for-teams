"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function RegisterPhoneForm({ open, onOpenChange, onCreated }: Props) {
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
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to register phone number";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Register Phone Number</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="meta">Meta</option>
              <option value="twilio">Twilio</option>
              <option value="360dialog">360dialog</option>
            </select>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Provider Config
            </p>
            {providerConfigFields[provider].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{field.label}</label>
                <Input
                  type={field.type || "text"}
                  value={providerConfig[field.key] || ""}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  placeholder={field.label}
                  required
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">WABA ID</label>
            <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Phone Number ID</label>
            <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Display Phone</label>
            <Input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} placeholder="+1 234 567 8900" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Business Phone" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Webhook Secret</label>
            <Input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Webhook Secret" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register Phone Number"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
