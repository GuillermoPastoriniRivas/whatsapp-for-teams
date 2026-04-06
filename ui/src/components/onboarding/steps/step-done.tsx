"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";

interface StepDoneProps {
  phoneConnected: boolean;
  agentsInvited: boolean;
  aiConfigured: boolean;
  onFinish: () => void;
}

export function StepDone({ phoneConnected, agentsInvited, aiConfigured, onFinish }: StepDoneProps) {
  const { t } = useTranslations();

  const items = [
    { label: t.onboarding.donePhoneConnected, done: phoneConnected },
    { label: t.onboarding.doneAgentsInvited, done: agentsInvited },
    { label: t.onboarding.doneAiConfigured, done: aiConfigured },
  ].filter((item) => item.done);

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>

      <div>
        <h2 className="text-3xl font-bold">{t.onboarding.doneTitle}</h2>
        <p className="mt-2 text-muted-foreground">{t.onboarding.doneSubtitle}</p>
      </div>

      {items.length > 0 && (
        <ul className="w-full max-w-xs space-y-2 text-left">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      <Button
        className="w-full max-w-xs h-12 text-base font-semibold rounded-xl"
        onClick={onFinish}
      >
        {t.onboarding.goToInbox}
      </Button>
    </div>
  );
}
