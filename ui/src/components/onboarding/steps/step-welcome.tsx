"use client";

import { MessageSquare, Bot, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useAuthStore } from "@/stores/auth.store";

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  const { t } = useTranslations();
  const agent = useAuthStore((s) => s.agent);

  return (
    <div className="flex flex-col items-center text-center gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t.onboarding.welcomeTitle}
        </h1>
        {agent?.name && (
          <p className="mt-1 text-xl text-primary font-medium">{agent.name}</p>
        )}
        <p className="mt-4 text-muted-foreground max-w-sm mx-auto">
          {t.onboarding.welcomeSubtitle}
        </p>
      </div>

      <ul className="w-full max-w-sm space-y-3 text-left">
        <li className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm">{t.onboarding.welcomeFeature1}</span>
        </li>
        <li className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm">{t.onboarding.welcomeFeature2}</span>
        </li>
        <li className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm">{t.onboarding.welcomeFeature3}</span>
        </li>
      </ul>

      <Button className="w-full max-w-sm h-12 text-base font-semibold rounded-xl" onClick={onNext}>
        {t.onboarding.welcomeStart}
      </Button>
    </div>
  );
}
