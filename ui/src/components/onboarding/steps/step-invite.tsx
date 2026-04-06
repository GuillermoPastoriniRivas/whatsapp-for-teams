"use client";

import { useState } from "react";
import { Plus, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <h2 className="text-2xl font-bold">{t.onboarding.inviteTitle}</h2>
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
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addEmail}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="h-4 w-4" />
          {t.onboarding.addAnother}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {sent ? (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          {t.onboarding.inviteSuccess}
        </div>
      ) : (
        <Button
          className="w-full rounded-xl h-11"
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
