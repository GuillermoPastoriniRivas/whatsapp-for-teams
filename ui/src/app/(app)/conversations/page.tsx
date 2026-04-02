"use client";

import { useTranslations } from "@/lib/i18n/use-translations";
import { AsisLogo } from "@/components/brand/asis-logo";

export default function ConversationsEmptyState() {
  const { t } = useTranslations();

  return (
    <div className="hidden md:flex flex-col h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
      <AsisLogo size={80} className="text-primary mb-6" />
      <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
        {t.conversations.emptyTitle}
      </h2>
      <p className="max-w-md text-slate-500 dark:text-slate-400">
        {t.conversations.emptyDescription}
      </p>
    </div>
  );
}
