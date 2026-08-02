"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/media";
import { FileText, Film, Loader2, Music, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/types";

export interface PendingAttachment {
  /** Archivo recién elegido, todavía sin subir. */
  file?: File;
  /** Archivo ya existente elegido de la biblioteca. */
  asset?: MediaAsset;
}

interface Props {
  attachment: PendingAttachment;
  uploading: boolean;
  error: string | null;
  onCancel: () => void;
}

/**
 * Barra sobre el composer con lo que se está por mandar. Sin esto, el agente
 * elige un archivo y no tiene ninguna señal de que pasó algo.
 */
export function AttachmentPreview({ attachment, uploading, error, onCancel }: Props) {
  const preview = useObjectUrl(attachment.file);
  const name = attachment.file?.name ?? attachment.asset?.filename ?? "Archivo";
  const size = attachment.file?.size ?? attachment.asset?.sizeBytes ?? 0;
  const mimeType = attachment.file?.type ?? attachment.asset?.mimeType ?? "";
  const thumbnail = preview ?? attachment.asset?.thumbnailUrl ?? null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-t border-border bg-[var(--asis-surface-header)] px-4 py-2.5 sm:px-6",
        error && "bg-red-50 dark:bg-red-950/30"
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/5 dark:bg-white/10">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <AttachmentIcon mimeType={mimeType} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{name}</p>
        {error ? (
          <p className="text-[12px] leading-snug text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            {uploading ? "Subiendo…" : formatBytes(size)}
          </p>
        )}
      </div>

      {uploading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}

      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        aria-label="Quitar adjunto"
        className="h-8 w-8 shrink-0 rounded-full text-slate-500"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/")) return <Film className="h-5 w-5 text-slate-500" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5 text-slate-500" />;
  return <FileText className="h-5 w-5 text-slate-500" />;
}

/** Preview local sin subir nada; se revoca al cambiar de archivo o al desmontar. */
function useObjectUrl(file: File | undefined): string | null {
  const url = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}
