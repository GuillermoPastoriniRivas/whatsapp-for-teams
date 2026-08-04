"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api, ApiError } from "@/lib/api";

interface StepInviteProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StepInvite({ onNext, onSkip }: StepInviteProps) {
  const { t } = useTranslations();
  const [emails, setEmails] = useState<string[]>([""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const updateEmail = (index: number, value: string) => {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  };

  const addEmail = () => setEmails((prev) => [...prev, ""]);

  const removeEmail = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const validEmails = emails.filter((e) => e.trim() && e.includes("@"));
    if (validEmails.length === 0) {
      onSkip();
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await Promise.all(
        validEmails.map((email) =>
          api.post("/agents/invite", { name: email.split("@")[0], email, role: "agent" })
        )
      );
      setSent(true);
      setTimeout(() => onNext(), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar invitaciones");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t.onboarding.inviteTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.onboarding.inviteSubtitle}</p>
      </div>

      <div className="space-y-2">
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="email"
              placeholder={t.onboarding.inviteEmailPlaceholder}
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
            />
            {emails.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeEmail(i)}
                className="shrink-0"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addEmail}
          className="flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="size-4" />
          {t.onboarding.addAnother}
        </button>
      </div>

      {error && <InlineNotice variant="error">{error}</InlineNotice>}

      {sent ? (
        <InlineNotice variant="success">{t.onboarding.inviteSuccess}</InlineNotice>
      ) : (
        <Button
          size="lg"
          className="w-full"
          onClick={handleSend}
          disabled={isLoading}
        >
          {isLoading ? t.onboarding.sending : t.onboarding.sendInvitations}
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
