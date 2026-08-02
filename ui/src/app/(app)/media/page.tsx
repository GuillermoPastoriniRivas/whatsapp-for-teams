"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Images,
  Loader2,
  Search,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Overlay } from "@/components/ui/overlay";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useMediaStore, type MediaScope } from "@/stores/media.store";
import { ACCEPTED_UPLOAD_TYPES, MEDIA_KIND_LABELS, validateUpload } from "@/lib/media";
import { ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import type { MediaAsset, MediaKind } from "@/types";
import { MediaCard } from "./_components/media-card";
import { MediaUsagePanel } from "./_components/media-usage-panel";

const SCOPES: { value: MediaScope; label: string }[] = [
  { value: "library", label: "Biblioteca" },
  { value: "history", label: "Historial" },
  { value: "all", label: "Todo" },
];

const KINDS: MediaKind[] = ["image", "video", "audio", "document"];

export default function MediaPage() {
  const {
    assets,
    usage,
    filters,
    total,
    page,
    pages,
    isLoading,
    isUploading,
    error,
    setFilters,
    fetch,
    fetchUsage,
    upload,
    update,
    remove,
    refreshOne,
  } = useMediaStore();

  const [searchInput, setSearchInput] = useState("");
  const [notice, setNotice] = useState<{ variant: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const storageEnabled = usage?.storageEnabled ?? false;

  useEffect(() => {
    void fetch(1);
    void fetchUsage();
    void useMediaStore.getState().fetchTags();
  }, [fetch, fetchUsage]);

  // Debounce de la búsqueda: no una request por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) setFilters({ search: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  // Un archivo terminó de bajarse a nuestro storage: se refresca esa tarjeta.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { assetId: string }) => void refreshOne(data.assetId);
    const backfill = () => {
      void fetch(1);
      void fetchUsage();
    };
    socket.on("media.updated", handler);
    socket.on("media.backfill", backfill);
    return () => {
      socket.off("media.updated", handler);
      socket.off("media.backfill", backfill);
    };
  }, [refreshOne, fetch, fetchUsage]);

  const handleUpload = async (file: File) => {
    const problem = validateUpload(file);
    if (problem) {
      setNotice({ variant: "error", text: problem });
      return;
    }
    try {
      await upload(file, { inLibrary: storageEnabled });
      setNotice({ variant: "success", text: `"${file.name}" se subió correctamente.` });
    } catch (uploadError) {
      setNotice({
        variant: "error",
        text: uploadError instanceof ApiError ? uploadError.message : "No se pudo subir el archivo.",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const activeKinds = useMemo(() => new Set(filters.kinds), [filters.kinds]);

  const toggleKind = (kind: MediaKind) => {
    setFilters({
      kinds: activeKinds.has(kind)
        ? filters.kinds.filter((item) => item !== kind)
        : [...filters.kinds, kind],
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold">Archivos</h1>
            <p className="text-[13px] text-muted-foreground">
              Todo lo que enviaste y recibiste por WhatsApp, en un solo lugar.
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={isUploading || !storageEnabled}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Subir archivo
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <section className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 space-y-3 border-b border-border px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                value={filters.scope}
                onValueChange={(value) => setFilters({ scope: value as MediaScope })}
              >
                <TabsList>
                  {SCOPES.map((scope) => (
                    <TabsTrigger key={scope.value} value={scope.value}>
                      {scope.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por nombre o etiqueta…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                    activeKinds.has(kind)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {MEDIA_KIND_LABELS[kind].es}
                </button>
              ))}
              {total > 0 && (
                <span className="ml-auto text-[12.5px] text-muted-foreground">
                  {total.toLocaleString("es-AR")} archivos
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {notice && (
              <InlineNotice variant={notice.variant} className="mb-4">
                {notice.text}
              </InlineNotice>
            )}
            {error && (
              <InlineNotice variant="error" className="mb-4">
                {error}
              </InlineNotice>
            )}

            {isLoading && assets.length === 0 && (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && assets.length === 0 && (
              <EmptyState
                scope={filters.scope}
                storageEnabled={storageEnabled}
                planIncludesLibrary={usage?.planIncludesLibrary ?? false}
              />
            )}

            {assets.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {assets.map((asset) => (
                  <MediaCard
                    key={asset.id}
                    asset={asset}
                    storageEnabled={storageEnabled}
                    onOpen={setPreview}
                    onToggleLibrary={(target) =>
                      void update(target.id, { inLibrary: !target.inLibrary }).catch((updateError) =>
                        setNotice({
                          variant: "error",
                          text:
                            updateError instanceof ApiError
                              ? updateError.message
                              : "No se pudo actualizar el archivo.",
                        })
                      )
                    }
                    onDelete={(target) => void remove(target.id)}
                  />
                ))}
              </div>
            )}

            {pages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void fetch(page - 1)}>
                  Anterior
                </Button>
                <span className="text-[13px] text-muted-foreground">
                  {page} / {pages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => void fetch(page + 1)}>
                  Siguiente
                </Button>
              </nav>
            )}
          </div>
        </section>

        <aside className="shrink-0 overflow-y-auto border-t border-border p-4 lg:w-80 lg:border-l lg:border-t-0">
          <MediaUsagePanel usage={usage} />
        </aside>
      </div>

      {preview && <PreviewOverlay asset={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function EmptyState({
  scope,
  storageEnabled,
  planIncludesLibrary,
}: {
  scope: MediaScope;
  storageEnabled: boolean;
  planIncludesLibrary: boolean;
}) {
  // El plan alcanza pero el entorno no tiene storage: el detalle está en el
  // panel de Uso, acá no corresponde ofrecer un upgrade.
  if (scope === "library" && !storageEnabled && planIncludesLibrary) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Images className="mb-3 h-9 w-9 text-muted-foreground/50" />
        <h2 className="text-[15px] font-semibold">La biblioteca todavía no está activa</h2>
        <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
          Tu plan la incluye, pero falta configurar el almacenamiento en este entorno.
        </p>
      </div>
    );
  }

  if (scope === "library" && !storageEnabled) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Images className="mb-3 h-9 w-9 text-muted-foreground/50" />
        <h2 className="text-[15px] font-semibold">La biblioteca es de los planes pagos</h2>
        <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
          En el plan gratuito los archivos viven 30 días en WhatsApp y después se pierden. Con un
          plan pago los guardamos nosotros y podés reusarlos cuando quieras.
        </p>
        <Button asChild className="mt-4">
          <Link href="/settings/billing">Ver planes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Images className="mb-3 h-9 w-9 text-muted-foreground/50" />
      <h2 className="text-[15px] font-semibold">
        {scope === "library" ? "Todavía no guardaste nada" : "Sin archivos todavía"}
      </h2>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
        {scope === "library"
          ? "Guardá acá lo que mandás seguido —catálogos, listas de precios, fotos— y reusalo desde cualquier chat."
          : "Cuando recibas o envíes un archivo por WhatsApp, va a aparecer acá."}
      </p>
    </div>
  );
}

function PreviewOverlay({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  return (
    <Overlay open onClose={onClose} label={asset.filename ?? "Archivo"} className="bg-black/85 p-4">
      {asset.kind === "image" || asset.kind === "sticker" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url ?? ""}
          alt={asset.filename ?? ""}
          className="max-h-full max-w-full object-contain"
        />
      ) : asset.kind === "video" ? (
        <video src={asset.url ?? undefined} controls autoPlay className="max-h-full max-w-full" />
      ) : (
        <div className="rounded-xl bg-background p-6 text-center">
          <p className="text-[14px] font-medium">{asset.filename ?? "Archivo"}</p>
          {asset.downloadUrl && (
            <Button asChild className="mt-4">
              <a href={asset.downloadUrl} download={asset.filename ?? undefined}>
                Descargar
              </a>
            </Button>
          )}
        </div>
      )}
    </Overlay>
  );
}
