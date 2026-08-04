"use client";

import { useTranslations } from "@/lib/i18n/use-translations";
import { AsisLogo } from "@/components/brand/asis-logo";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConversationsEmptyState() {
  const { t } = useTranslations();

  return (
    <div className="hidden h-full w-full flex-col items-center justify-center md:flex">
      {/* El logo va afuera del EmptyState: no es un icono de lucide, es la marca. */}
      <AsisLogo size={80} className="mb-2 text-primary" />
      <EmptyState
        title={t.conversations.emptyTitle}
        description={t.conversations.emptyDescription}
        className="py-0"
      />
    </div>
  );
}
