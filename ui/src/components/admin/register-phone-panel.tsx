"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Phone } from "lucide-react";

type Provider = "meta" | "twilio" | "360dialog";

const providerConfigFields: Record<Provider, { key: string; label: string }[]> = {
  meta: [{ key: "accessToken", label: "Access Token" }],
  twilio: [
    { key: "accountSid", label: "Account SID" },
    { key: "authToken", label: "Auth Token" },
    { key: "fromNumber", label: "From Number" },
  ],
  "360dialog": [{ key: "apiKey", label: "API Key" }],
};

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function RegisterPhonePanel({ onCreated, onCancel }: Props) {
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
      const message = err instanceof Error ? err.message : "Failed to register phone number";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="px-4 pt-6 pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Register Phone Number</h2>
            <p className="text-xs text-muted-foreground">Add a new phone number</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Provider</label>
          <div className="flex gap-2">
            {(["meta", "twilio", "360dialog"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProviderChange(p)}
                className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                  provider === p
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                {p === "360dialog" ? "360dialog" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Provider Config
          </p>
          {providerConfigFields[provider].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium">{field.label}</label>
              <Input
                value={providerConfig[field.key] || ""}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                placeholder={field.label}
                required
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">WABA ID</label>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Phone Number ID</label>
          <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Display Phone</label>
          <Input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} placeholder="+1 234 567 8900" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Label</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Business Phone" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Webhook Secret</label>
          <Input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Webhook Secret" />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            type="submit"
            size="sm"
            className="bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register"}
          </Button>
        </div>
      </form>
    </>
  );
}
