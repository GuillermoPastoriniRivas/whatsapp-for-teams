"use client";

import { useTranslations } from "@/lib/i18n/use-translations";
import { FluwsLockup } from "@/components/brand/fluws-lockup";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConversationsEmptyState() {
  const { t } = useTranslations();

  return (
    <div className="hidden h-full w-full flex-col items-center justify-center md:flex">
      {/* El título es el lockup de marca, no una cadena traducida: así usa la
          tipografía, el color y la proporción de marca como el resto de la app,
          en vez de la fuente de la interfaz. */}
      <EmptyState
        title={<FluwsLockup size={56} />}
        description={t.conversations.emptyDescription}
        className="py-0"
      />
    </div>
  );
}
