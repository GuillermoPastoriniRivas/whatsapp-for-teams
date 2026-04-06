"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import type { PhoneNumber } from "@/types";

export function OnboardingChecklist() {
  const { t } = useTranslations();
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<PhoneNumber[]>("/phone-numbers").catch(() => [] as PhoneNumber[]),
      api.get<{ data?: { role: string }[] } | { role: string }[]>("/agents").catch(() => []),
      api.get<{ data?: unknown[] } | unknown[]>("/ai-agents").catch(() => []),
    ]).then(([phonesRes, agentsRes, aiRes]) => {
      setPhones(Array.isArray(phonesRes) ? phonesRes : []);
      const agents = Array.isArray(agentsRes) ? agentsRes : (agentsRes as { data?: { role: string }[] }).data ?? [];
      setAgentCount(agents.filter((a: { role: string }) => a.role === "agent").length);
      const ais = Array.isArray(aiRes) ? aiRes : (aiRes as { data?: unknown[] }).data ?? [];
      setAiCount(ais.length);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  const hasPhone = phones.length > 0;
  const hasAgent = agentCount > 0;
  const hasAi = aiCount > 0;
  const allDone = hasPhone && hasAgent && hasAi;

  const firstPhone = phones[0];
  const testLink = firstPhone
    ? `https://wa.me/${firstPhone.displayPhone.replace(/\D/g, "")}`
    : null;

  const items = [
    { label: t.onboarding.checklistAccount, done: true, link: null },
    {
      label: hasPhone ? t.onboarding.checklistPhone : t.onboarding.checklistPhoneCta,
      done: hasPhone,
      link: hasPhone ? null : "/admin",
    },
    {
      label: hasAgent ? t.onboarding.checklistAgent : t.onboarding.checklistAgentCta,
      done: hasAgent,
      link: hasAgent ? null : "/agents",
    },
    {
      label: hasAi ? t.onboarding.checklistAi : t.onboarding.checklistAiCta,
      done: hasAi,
      link: hasAi ? null : "/agents",
    },
  ];

  return (
    <div className="mx-3 my-4 rounded-xl border bg-card p-4 space-y-4">
      <div>
        <p className="font-semibold text-sm">{t.onboarding.checklistTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t.onboarding.checklistSubtitle}</p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            {item.link ? (
              <Link href={item.link} className="text-primary hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
            )}
          </li>
        ))}
      </ul>

      {testLink && (
        <a
          href={testLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ExternalLink className="h-3 w-3" />
            {t.onboarding.testMessage}
          </Button>
        </a>
      )}

      {allDone && (
        <p className="text-xs text-green-600 font-medium">✓ Todo listo para recibir mensajes</p>
      )}
    </div>
  );
}
