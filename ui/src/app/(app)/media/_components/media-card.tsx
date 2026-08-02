"use client";

import { cn } from "@/lib/utils";
import { daysUntilExpiry, formatBytes, MEDIA_KIND_LABELS } from "@/lib/media";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  BookmarkPlus,
  BookmarkX,
  CloudOff,
  Download,
  FileText,
  Film,
  Loader2,
  MoreVertical,
  Music,
  Trash2,
} from "lucide-react";
import type { MediaAsset } from "@/types";

interface Props {
  asset: MediaAsset;
  storageEnabled: boolean;
  onOpen: (asset: MediaAsset) => void;
  onToggleLibrary: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

export function MediaCard({ asset, storageEnabled, onOpen, onToggleLibrary, onDelete }: Props) {
  const expiresIn = daysUntilExpiry(asset);
  const isVisual = asset.kind === "image" || asset.kind === "sticker";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border transition-colors hover:border-primary/50">
      <button
        type="button"
        onClick={() => onOpen(asset)}
        className="flex aspect-square w-full items-center justify-center bg-muted/60"
      >
        {asset.processing ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : !asset.available ? (
          <CloudOff className="h-7 w-7 text-muted-foreground/60" />
        ) : isVisual && asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.filename ?? ""}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <KindIcon kind={asset.kind} />
        )}
      </button>

      <div className="flex min-w-0 items-start gap-1 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">
            {asset.title ?? asset.filename ?? MEDIA_KIND_LABELS[asset.kind].es}
          </p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {asset.sizeBytes ? formatBytes(asset.sizeBytes) : MEDIA_KIND_LABELS[asset.kind].es}
            {" · "}
            {new Date(asset.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Acciones"
              className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {asset.downloadUrl && asset.available && (
              <DropdownMenuItem asChild>
                <a href={asset.downloadUrl} download={asset.filename ?? undefined}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </a>
              </DropdownMenuItem>
            )}
            {storageEnabled && (
              <DropdownMenuItem onSelect={() => onToggleLibrary(asset)}>
                {asset.inLibrary ? (
                  <>
                    <BookmarkX className="mr-2 h-4 w-4" />
                    Quitar de la biblioteca
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                    Guardar en la biblioteca
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(asset)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* El aviso de vencimiento es el gancho: aparece justo donde duele. */}
      {expiresIn !== null && (
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur",
            expiresIn <= 3
              ? "bg-destructive/90 text-white"
              : "bg-black/55 text-white"
          )}
        >
          {expiresIn === 0 ? "Vence hoy" : `${expiresIn} d`}
        </span>
      )}

      {asset.inLibrary && (
        <span className="absolute right-2 top-2 rounded-full bg-primary/90 p-1 text-white">
          <BookmarkPlus className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: MediaAsset["kind"] }) {
  const className = "h-8 w-8 text-muted-foreground/60";
  if (kind === "video") return <Film className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}
