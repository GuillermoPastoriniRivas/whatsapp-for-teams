"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";

export function DemoBanner() {
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();

  if (agent?.email !== "demo@asis.chat") return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-sm text-primary">
      {t.common.demoBanner}
    </div>
  );
}
