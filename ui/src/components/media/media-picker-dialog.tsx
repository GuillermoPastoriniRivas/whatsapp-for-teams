"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/media";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/ui/overlay";
import { FileText, Film, ImageIcon, Loader2, Music, Search, X } from "lucide-react";
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
        if (!cancelled) setError("No se pudo cargar la biblioteca.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search, kinds]);

  return (
    <Overlay
      open={open}
      onClose={onClose}
      label={title ?? "Elegir de la biblioteca"}
      className="items-end sm:items-center"
    >
      <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-background sm:h-[70vh] sm:rounded-2xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="flex-1 text-[15px] font-semibold">{title ?? "Elegir de la biblioteca"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="border-b border-border px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o etiqueta…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && error && <p className="text-center text-[13px] text-red-600">{error}</p>}

          {!loading && !error && assets.length === 0 && <EmptyLibrary hasSearch={!!search.trim()} />}

          {!loading && assets.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {assets.map((asset) => (
                <AssetTile key={asset.id} asset={asset} onSelect={() => { onSelect(asset); onClose(); }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function EmptyLibrary({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <ImageIcon className="mb-3 h-8 w-8 text-slate-300" />
      <p className="text-[14px] font-medium text-slate-700 dark:text-slate-200">
        {hasSearch ? "Sin resultados" : "Todavía no hay nada en la biblioteca"}
      </p>
      <p className="mt-1 max-w-xs text-[13px] text-slate-500">
        {hasSearch
          ? "Probá con otro nombre o etiqueta."
          : "Guardá acá lo que mandás seguido —catálogos, listas de precios, fotos— y reusalo en un clic."}
      </p>
    </div>
  );
}

function AssetTile({ asset, onSelect }: { asset: MediaAsset; onSelect: () => void }) {
  const isVisual = asset.kind === "image" || asset.kind === "sticker";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-primary",
        !asset.available && "opacity-50"
      )}
    >
      <span className="flex aspect-square w-full items-center justify-center bg-black/5 dark:bg-white/10">
        {isVisual && asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <KindIcon kind={asset.kind} />
        )}
      </span>
      <span className="min-w-0 px-2 py-1.5">
        <span className="block truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {asset.title ?? asset.filename ?? "Sin nombre"}
        </span>
        <span className="block text-[11px] text-slate-500">{formatBytes(asset.sizeBytes)}</span>
      </span>
    </button>
  );
}

function KindIcon({ kind }: { kind: MediaKind }) {
  const className = "h-7 w-7 text-slate-400";
  if (kind === "video") return <Film className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}
