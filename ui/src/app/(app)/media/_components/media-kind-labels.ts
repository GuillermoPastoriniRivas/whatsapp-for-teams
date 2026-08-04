"use client";

import { useTranslations } from "@/lib/i18n/use-translations";
import type { MediaKind } from "@/types";

/**
 * Etiquetas de tipo de archivo en el idioma activo. Vive acá y no en
 * `lib/media.ts` porque las traducciones son un hook: `lib/media.ts` se usa
 * también fuera de React (validación previa a la subida).
 */
export function useMediaKindLabels(): Record<MediaKind, string> {
  const { t } = useTranslations();
  return {
    image: t.media.kindImage,
    video: t.media.kindVideo,
    audio: t.media.kindAudio,
    document: t.media.kindDocument,
    sticker: t.media.kindSticker,
  };
}
