"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Images, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPill } from "@/components/ui/filter-pill";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { MediaLightbox } from "@/components/media/media-lightbox";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useMediaStore, type MediaScope } from "@/stores/media.store";
import { ACCEPTED_UPLOAD_TYPES, validateUpload } from "@/lib/media";
import { ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { MediaAsset, MediaKind } from "@/types";
import { MediaCard } from "./_components/media-card";
import { MediaUsagePanel } from "./_components/media-usage-panel";
import { useMediaKindLabels } from "./_components/media-kind-labels";

const SCOPES: MediaScope[] = ["library", "history", "all"];

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

  const { t } = useTranslations();
  const kindLabels = useMediaKindLabels();

  const [searchInput, setSearchInput] = useState("");
  const [notice, setNotice] = useState<{ variant: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const storageEnabled = usage?.storageEnabled ?? false;

  const scopeLabels: Record<MediaScope, string> = {
    library: t.media.scopeLibrary,
    history: t.media.scopeHistory,
    all: t.media.scopeAll,
  };

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
      setNotice({ variant: "success", text: t.media.uploadSuccess.replace("{name}", file.name) });
    } catch (uploadError) {
      setNotice({
        variant: "error",
        text: uploadError instanceof ApiError ? uploadError.message : t.media.uploadError,
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
    <PageShell>
      <PageHeader
        title={t.media.title}
        subtitle={t.media.subtitle}
        actions={
          <>
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
            <Button
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading || !storageEnabled}
            >
              {isUploading ? <Spinner size="sm" className="text-current" /> : <Upload />}
              {t.media.upload}
            </Button>
          </>
        }
      >
        {SCOPES.map((scope) => (
          <FilterPill
            key={scope}
            active={filters.scope === scope}
            onClick={() => setFilters({ scope })}
          >
            {scopeLabels[scope]}
          </FilterPill>
        ))}
      </PageHeader>

      {/* Segunda barra: buscador + tipos. El scope vive arriba porque es
          excluyente; los tipos se combinan entre sí. */}
      <div className="shrink-0 border-b px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t.media.searchPlaceholder}
              className="pl-9"
            />
          </div>
          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
            {KINDS.map((kind) => (
              <FilterPill
                key={kind}
                active={activeKinds.has(kind)}
                onClick={() => toggleKind(kind)}
              >
                {kindLabels[kind]}
              </FilterPill>
            ))}
          </div>
          {total > 0 && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {t.media.filesCount.replace("{count}", total.toLocaleString("es-AR"))}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <PageContent className="min-w-0 flex-1">
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

          {isLoading && assets.length === 0 && <LoadingState />}

          {!isLoading && assets.length === 0 && (
            <MediaEmptyState
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
                            : t.media.updateError,
                      })
                    )
                  }
                  onDelete={(target) => void remove(target.id)}
                />
              ))}
            </div>
          )}

          <Pagination page={page} pages={pages} onPageChange={(next) => void fetch(next)} />

          {/* En mobile el uso va abajo del listado, dentro del mismo scroll: dos
              áreas de scroll apiladas dejaban la grilla sin espacio. */}
          <div className="mt-6 lg:hidden">
            <MediaUsagePanel usage={usage} />
          </div>
        </PageContent>

        <aside className="hidden shrink-0 overflow-y-auto border-l p-4 lg:block lg:w-80">
          <MediaUsagePanel usage={usage} />
        </aside>
      </div>

      {preview && <PreviewOverlay asset={preview} onClose={() => setPreview(null)} />}
    </PageShell>
  );
}

function MediaEmptyState({
  scope,
  storageEnabled,
  planIncludesLibrary,
}: {
  scope: MediaScope;
  storageEnabled: boolean;
  planIncludesLibrary: boolean;
}) {
  const { t } = useTranslations();

  // El plan alcanza pero el entorno no tiene storage: el detalle está en el
  // panel de Uso, acá no corresponde ofrecer un upgrade.
  if (scope === "library" && !storageEnabled && planIncludesLibrary) {
    return (
      <EmptyState
        icon={Images}
        title={t.media.emptyInactiveTitle}
        description={t.media.emptyInactiveBody}
      />
    );
  }

  if (scope === "library" && !storageEnabled) {
    return (
      <EmptyState
        icon={Images}
        title={t.media.emptyPaidTitle}
        description={t.media.emptyPaidBody}
        action={
          <Button asChild>
            <Link href="/settings/billing">{t.media.viewPlans}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={Images}
      title={scope === "library" ? t.media.emptyLibraryTitle : t.media.emptyHistoryTitle}
      description={scope === "library" ? t.media.emptyLibraryBody : t.media.emptyHistoryBody}
    />
  );
}

function PreviewOverlay({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const { t } = useTranslations();
  const title = asset.filename ?? t.media.untitled;
  const isImage = asset.kind === "image" || asset.kind === "sticker";

  return (
    <MediaLightbox
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      src={isImage ? asset.url : undefined}
      alt={asset.filename ?? ""}
      downloadUrl={isImage ? asset.downloadUrl : undefined}
      downloadFilename={asset.filename}
    >
      {isImage ? undefined : asset.kind === "video" ? (
        <video
          src={asset.url ?? undefined}
          controls
          autoPlay
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full"
        />
      ) : (
        <div
          onClick={(event) => event.stopPropagation()}
          className="rounded-xl bg-background p-6 text-center"
        >
          <p className="text-sm font-medium">{title}</p>
          {asset.downloadUrl && (
            <Button asChild className="mt-4">
              <a href={asset.downloadUrl} download={asset.filename ?? undefined}>
                {t.media.download}
              </a>
            </Button>
          )}
        </div>
      )}
    </MediaLightbox>
  );
}
