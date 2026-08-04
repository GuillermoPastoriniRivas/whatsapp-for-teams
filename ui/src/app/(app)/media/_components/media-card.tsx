"use client";

import { cn } from "@/lib/utils";
import { daysUntilExpiry, formatBytes } from "@/lib/media";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "@/lib/i18n/use-translations";
import {
  BookmarkPlus,
  BookmarkX,
  CloudOff,
  Download,
  FileText,
  Film,
  MoreVertical,
  Music,
  Trash2,
} from "lucide-react";
import type { MediaAsset } from "@/types";
import { useMediaKindLabels } from "./media-kind-labels";

interface Props {
  asset: MediaAsset;
  storageEnabled: boolean;
  onOpen: (asset: MediaAsset) => void;
  onToggleLibrary: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

export function MediaCard({ asset, storageEnabled, onOpen, onToggleLibrary, onDelete }: Props) {
  const { t } = useTranslations();
  const kindLabels = useMediaKindLabels();
  const expiresIn = daysUntilExpiry(asset);
  const isVisual = asset.kind === "image" || asset.kind === "sticker";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border transition-colors hover:border-primary/50">
      <button
        type="button"
        onClick={() => onOpen(asset)}
        className="flex aspect-square w-full items-center justify-center bg-muted/60"
      >
        {asset.processing ? (
          <Spinner size="lg" />
        ) : !asset.available ? (
          <CloudOff className="size-7 text-muted-foreground/60" />
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
          <p className="truncate text-sm font-medium">
            {asset.title ?? asset.filename ?? kindLabels[asset.kind]}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {asset.sizeBytes ? formatBytes(asset.sizeBytes) : kindLabels[asset.kind]}
            {" · "}
            {new Date(asset.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.media.cardActions}
              // En mobile no hay hover: si se esconde, el menú es inalcanzable.
              className="shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:aria-expanded:opacity-100"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {asset.downloadUrl && asset.available && (
              <DropdownMenuItem asChild>
                <a href={asset.downloadUrl} download={asset.filename ?? undefined}>
                  <Download className="mr-2 size-4" />
                  {t.media.download}
                </a>
              </DropdownMenuItem>
            )}
            {storageEnabled && (
              <DropdownMenuItem onSelect={() => onToggleLibrary(asset)}>
                {asset.inLibrary ? (
                  <>
                    <BookmarkX className="mr-2 size-4" />
                    {t.media.removeFromLibrary}
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="mr-2 size-4" />
                    {t.media.saveToLibrary}
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(asset)}>
              <Trash2 className="mr-2 size-4" />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* El aviso de vencimiento es el gancho: aparece justo donde duele. */}
      {expiresIn !== null && (
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium text-white backdrop-blur",
            expiresIn <= 3 ? "bg-destructive/90" : "bg-black/55"
          )}
        >
          {expiresIn === 0
            ? t.media.expiresToday
            : t.media.expiresInDays.replace("{days}", String(expiresIn))}
        </span>
      )}

      {asset.inLibrary && (
        <span className="absolute right-2 top-2 rounded-full bg-primary/90 p-1 text-white">
          <BookmarkPlus className="size-3" />
        </span>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: MediaAsset["kind"] }) {
  const className = "size-8 text-muted-foreground/60";
  if (kind === "video") return <Film className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}
