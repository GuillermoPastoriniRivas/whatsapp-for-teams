"use client";

import { useTranslations } from "@/lib/i18n/use-translations";
import { FluwsLogo } from "@/components/brand/fluws-logo";
import { FluwsWordmark } from "@/components/brand/fluws-wordmark";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConversationsEmptyState() {
  const { t } = useTranslations();

  return (
    <div className="hidden h-full w-full flex-col items-center justify-center md:flex">
      {/* El logo va afuera del EmptyState: no es un icono de lucide, es la marca. */}
      <FluwsLogo size={80} className="mb-2" />
      {/* El título es el wordmark, no una cadena traducida: acá abajo del
          símbolo es un lockup de marca, así que va en la tipografía y el color
          de marca como en el resto de la app, y no en la fuente de la interfaz. */}
      <EmptyState
        title={<FluwsWordmark className="text-2xl" />}
        description={t.conversations.emptyDescription}
        className="py-0"
      />
    </div>
  );
}
