"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ArrowRight } from "lucide-react";

export function DemoBanner() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useTranslations();

  if (agent?.email !== "demo@asis.chat") return null;

  const handleCreateAccount = () => {
    logout();
    router.push("/signup");
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-3 py-2 flex items-center justify-center gap-3 text-sm">
      <span className="text-primary">{t.common.demoBanner}</span>
      <button
        onClick={handleCreateAccount}
        className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t.common.demoCta}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
