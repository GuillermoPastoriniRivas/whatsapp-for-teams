"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/media";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useTranslations } from "@/lib/i18n/use-translations";
import { FileText, Film, ImageIcon, Music, Search } from "lucide-react";
import type { MediaAsset, MediaKind, PaginatedResponse } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  /** Limita a ciertos tipos (p. ej. solo imágenes para el header de una plantilla). */
  kinds?: MediaKind[];
  title?: string;
}

/**
 * Selector de la biblioteca curada.
 *
 * Solo muestra `scope=library`: el historial completo son decenas de miles de
 * archivos y como selector no sirve. Para buscar ahí está la pantalla /media.
 */
export function MediaPickerDialog({ open, onClose, onSelect, kinds, title }: Props) {
  const { t } = useTranslations();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ scope: "library", limit: "60", page: "1" });
        if (kinds?.length) params.set("kinds", kinds.join(","));
        if (search.trim()) params.set("search", search.trim());
        const data = await api.get<PaginatedResponse<MediaAsset>>(`/media?${params}`);
        if (!cancelled) setAssets(data.data);
      } catch {
        if (!cancelled) setError(t.media.pickerLoadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search, kinds, t.media.pickerLoadError]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title ?? t.media.pickerTitle}
      size="lg"
      className="sm:h-[70vh]"
    >
      {/* Full-bleed pegado arriba: el buscador queda fijo y solo scrollea la grilla. */}
      <div className="sticky top-0 z-(--z-sticky) -mx-4 -mt-4 mb-3 border-b bg-background px-4 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.media.searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      {loading && <LoadingState />}

      {!loading && error && <InlineNotice variant="error">{error}</InlineNotice>}

      {!loading && !error && assets.length === 0 && <EmptyLibrary hasSearch={!!search.trim()} />}

      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              onSelect={() => {
                onSelect(asset);
                onClose();
              }}
            />
          ))}
        </div>
      )}
    </ResponsiveDialog>
  );
}

function EmptyLibrary({ hasSearch }: { hasSearch: boolean }) {
  const { t } = useTranslations();

  return (
    <EmptyState
      icon={ImageIcon}
      title={hasSearch ? t.media.pickerNoResultsTitle : t.media.pickerEmptyTitle}
      description={hasSearch ? t.media.pickerNoResultsBody : t.media.pickerEmptyBody}
    />
  );
}

function AssetTile({ asset, onSelect }: { asset: MediaAsset; onSelect: () => void }) {
  const { t } = useTranslations();
  const isVisual = asset.kind === "image" || asset.kind === "sticker";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-primary",
        !asset.available && "opacity-50"
      )}
    >
      <span className="flex aspect-square w-full items-center justify-center bg-muted/60">
        {isVisual && asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <KindIcon kind={asset.kind} />
        )}
      </span>
      <span className="min-w-0 px-2 py-1.5">
        <span className="block truncate text-xs font-medium">
          {asset.title ?? asset.filename ?? t.media.untitled}
        </span>
        <span className="block text-xs text-muted-foreground">{formatBytes(asset.sizeBytes)}</span>
      </span>
    </button>
  );
}

function KindIcon({ kind }: { kind: MediaKind }) {
  const className = "size-7 text-muted-foreground/60";
  if (kind === "video") return <Film className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}
