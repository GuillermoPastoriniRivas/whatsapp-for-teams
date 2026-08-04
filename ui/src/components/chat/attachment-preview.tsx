"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/media";
import { FileText, Film, Music, X } from "lucide-react";
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
        error && "bg-destructive/10"
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
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {error ? (
          <p className="text-xs leading-snug text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {uploading ? "Subiendo…" : formatBytes(size)}
          </p>
        )}
      </div>

      {uploading && <Spinner size="sm" className="shrink-0" />}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onCancel}
        aria-label="Quitar adjunto"
        className="shrink-0 rounded-full text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/")) return <Film className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5 text-muted-foreground" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
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
