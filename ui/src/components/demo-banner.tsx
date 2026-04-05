"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ArrowRight } from "lucide-react";

export function DemoBanner() {
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();

  if (agent?.email !== "demo@asis.chat") return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-3 py-2 flex items-center justify-center gap-3 text-sm">
      <span className="text-primary">{t.common.demoBanner}</span>
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t.common.demoCta}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
