"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/ui/overlay";
import { formatBytes, formatDuration } from "@/lib/media";
import type { MediaAsset } from "@/types";
import {
  CloudOff,
  Download,
  FileText,
  Film,
  Loader2,
  Music,
  X,
} from "lucide-react";

interface Props {
  media: MediaAsset;
  /** Cambia los colores para que contrasten con la burbuja saliente. */
  outbound?: boolean;
}

/**
 * Render del archivo dentro de la burbuja.
 *
 * Tres estados que hay que distinguir siempre, porque son tres cosas muy
 * distintas para el usuario: se está bajando, está listo, o se perdió porque
 * WhatsApp solo lo guarda 30 días.
 */
export function MessageMedia({ media, outbound }: Props) {
  if (media.processing) return <MediaProcessing />;
  if (!media.available) return <MediaExpired media={media} />;

  switch (media.kind) {
    case "image":
    case "sticker":
      return <MediaImage media={media} />;
    case "video":
      return <MediaVideo media={media} />;
    case "audio":
      return <MediaAudio media={media} outbound={outbound} />;
    default:
      return <MediaDocument media={media} outbound={outbound} />;
  }
}

function MediaProcessing() {
  return (
    <div className="my-1 flex h-32 w-56 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10">
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
    </div>
  );
}

/**
 * El archivo se perdió. La copy tiene que dejar claro que el límite es de
 * WhatsApp y que nosotros somos la solución, no el problema.
 */
function MediaExpired({ media }: { media: MediaAsset }) {
  return (
    <div className="my-1 w-full max-w-xs rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-white/5">
      <div className="flex items-start gap-2.5">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {media.filename ?? "Archivo no disponible"}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            WhatsApp guarda los archivos solo 30 días.{" "}
            <Link href="/settings/billing" className="font-medium text-primary hover:underline">
              Guardalos para siempre
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function MediaImage({ media }: { media: MediaAsset }) {
  const [zoomed, setZoomed] = useState(false);
  const isSticker = media.kind === "sticker";

  // Reservar el alto real evita que el chat salte cuando termina de cargar.
  const ratio = media.width && media.height ? media.width / media.height : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className={cn(
          "my-1 block overflow-hidden",
          isSticker ? "w-32" : "w-full max-w-xs rounded-xl bg-black/5 dark:bg-white/10"
        )}
        style={ratio ? { aspectRatio: String(ratio) } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.thumbnailUrl ?? media.url ?? ""}
          alt={media.filename ?? "Imagen"}
          loading="lazy"
          className={cn("h-full w-full", isSticker ? "object-contain" : "object-cover")}
        />
      </button>

      {zoomed && <Lightbox media={media} onClose={() => setZoomed(false)} />}
    </>
  );
}

function Lightbox({ media, onClose }: { media: MediaAsset; onClose: () => void }) {
  return (
    <Overlay open onClose={onClose} label={media.filename ?? "Imagen"} className="bg-black/85 p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url ?? ""}
        alt={media.filename ?? "Imagen"}
        className="max-h-full max-w-full object-contain"
      />
      {media.downloadUrl && (
        <a
          href={media.downloadUrl}
          download
          className="absolute bottom-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white hover:bg-white/20"
        >
          <Download className="h-4 w-4" />
          Descargar
        </a>
      )}
    </Overlay>
  );
}

function MediaVideo({ media }: { media: MediaAsset }) {
  return (
    <div className="my-1 w-full max-w-xs overflow-hidden rounded-xl bg-black">
      <video
        src={media.url ?? undefined}
        poster={media.thumbnailUrl ?? undefined}
        controls
        preload="metadata"
        className="h-full w-full"
      >
        <Film className="h-6 w-6" />
      </video>
    </div>
  );
}

function MediaAudio({ media, outbound }: { media: MediaAsset; outbound?: boolean }) {
  const duration = formatDuration(media.durationMs);

  return (
    <div className="my-1 w-full min-w-[220px] max-w-xs">
      <div className="flex items-center gap-2">
        <Music className={cn("h-4 w-4 shrink-0", outbound ? "text-slate-600" : "text-slate-500")} />
        <audio src={media.url ?? undefined} controls preload="metadata" className="h-9 w-full" />
      </div>
      {duration && <p className="mt-0.5 pl-6 text-[11px] text-slate-500">{duration}</p>}
    </div>
  );
}

function MediaDocument({ media, outbound }: { media: MediaAsset; outbound?: boolean }) {
  return (
    <a
      href={media.downloadUrl ?? media.url ?? "#"}
      download={media.filename ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "my-1 flex w-full max-w-xs items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        outbound
          ? "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
          : "bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/10 dark:hover:bg-white/15"
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <FileText className="h-4.5 w-4.5 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {media.filename ?? "Documento"}
        </span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {media.sizeBytes ? formatBytes(media.sizeBytes) : media.mimeType}
        </span>
      </span>
      <Download className="h-4 w-4 shrink-0 text-slate-400" />
    </a>
  );
}
