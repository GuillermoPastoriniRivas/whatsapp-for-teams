"use client";

import { useState } from "react";
import { Mail, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateAgentPanel({ onCreated, onCancel }: Props) {
  const { t } = useTranslations();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/agents/invite", { name, email, role });
      setSuccess(true);
      setTimeout(() => onCreated(), 2000);
    } catch (err: any) {
      setError(err.message || t.agents.inviteError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="border-b px-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t.agents.invite}</h2>
            <p className="text-xs text-muted-foreground">{t.agents.inviteSubtitle}</p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="space-y-3 px-4 py-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-6" />
          </div>
          <p className="text-sm font-medium">
            {t.agents.inviteSent} {email}
          </p>
          <p className="text-xs text-muted-foreground">{t.agents.inviteSentHint}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
          <Field label={t.agents.fullName} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.agents.fullNamePlaceholder}
              required
            />
          </Field>

          <Field label={t.agents.email} required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.agents.emailPlaceholder}
              required
            />
          </Field>

          <Field label={t.agents.role}>
            <div role="radiogroup" className="flex gap-2">
              {(["agent", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs transition-colors",
                    role === r ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  {r === "admin" ? t.agents.roleAdmin : t.agents.roleAgent}
                </button>
              ))}
            </div>
          </Field>

          <InlineNotice>{t.agents.inviteHint}</InlineNotice>

          {error && <InlineNotice variant="error">{error}</InlineNotice>}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {t.common.cancel}
            </Button>
            <div className="flex-1" />
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {loading ? t.agents.sending : t.agents.sendInvite}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
