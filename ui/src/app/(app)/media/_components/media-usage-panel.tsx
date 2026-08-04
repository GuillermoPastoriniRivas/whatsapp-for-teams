"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/media";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import { CloudOff, HardDrive, ShieldCheck, TriangleAlert } from "lucide-react";
import type { MediaUsage } from "@/types";
import { useMediaKindLabels } from "./media-kind-labels";

interface Props {
  usage: MediaUsage | null;
}

export function MediaUsagePanel({ usage }: Props) {
  if (!usage) return null;

  // Tres estados, no dos. Que el plan incluya biblioteca y aun así no se
  // guarde nada es un problema de configuración del entorno: mostrarle un
  // "pasate a un plan pago" a alguien que ya paga es peor que no decir nada.
  const misconfigured = usage.planIncludesLibrary && !usage.storageConfigured;

  return (
    <div className="space-y-4">
      {misconfigured ? (
        <StorageMisconfigured />
      ) : usage.storageEnabled ? (
        <StoredSummary usage={usage} />
      ) : (
        <PassthroughSummary usage={usage} />
      )}
      <KindBreakdown usage={usage} />
    </div>
  );
}

function StorageMisconfigured() {
  const { t } = useTranslations();

  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <header className="mb-2 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <TriangleAlert className="size-4.5 text-amber-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{t.media.storageMisconfiguredTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.media.storageMisconfiguredBody}</p>
        </div>
      </header>
      <p className="rounded-lg bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground">
        MEDIA_S3_BUCKET=… <span className="font-sans">{t.media.envProduction}</span>
        <br />
        MEDIA_LOCAL_PATH=./.media-storage <span className="font-sans">{t.media.envDevelopment}</span>
      </p>
    </section>
  );
}

/** Plan pago: cuánto ocupa y cuánto queda. */
function StoredSummary({ usage }: { usage: MediaUsage }) {
  const { t } = useTranslations();
  const unlimited = usage.quotaBytes <= 0;
  const percent = usage.usedPercent ?? 0;
  const nearLimit = percent >= 80;

  const consumed = unlimited
    ? t.media.storageUsedUnlimited.replace("{used}", formatBytes(usage.storedBytes))
    : t.media.storageUsedOf
        .replace("{used}", formatBytes(usage.storedBytes))
        .replace("{quota}", formatBytes(usage.quotaBytes));

  return (
    <section className="rounded-xl border p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <HardDrive className="size-4.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{t.media.storageTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {consumed} ·{" "}
            {t.media.filesCount.replace("{count}", usage.storedCount.toLocaleString("es-AR"))}
          </p>
        </div>
      </header>

      {!unlimited && (
        <Progress
          value={percent}
          indicatorClassName={cn(nearLimit && "bg-amber-500", percent >= 100 && "bg-destructive")}
        />
      )}

      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-emerald-600" />
        {usage.retentionDays < 0
          ? t.media.retentionForever
          : t.media.retentionDays.replace("{days}", String(usage.retentionDays))}
      </p>

      {nearLimit && !unlimited && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {t.media.nearLimit.replace("{percent}", String(percent))}{" "}
            <Link href="/settings/billing" className="font-medium underline">
              {t.media.upgradePlan}
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Plan free: el motor de conversión.
 *
 * Un número concreto de archivos ya perdidos convierte mucho más que cualquier
 * beneficio abstracto. La copy deja claro que el límite es de WhatsApp.
 */
function PassthroughSummary({ usage }: { usage: MediaUsage }) {
  const { t } = useTranslations();

  return (
    <section className="rounded-xl border p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <CloudOff className="size-4.5 text-amber-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{t.media.passthroughTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.media.passthroughBody}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">{t.media.availableNow}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {usage.metaOnlyCount.toLocaleString("es-AR")}
          </dd>
          <dd className="text-xs text-muted-foreground">{formatBytes(usage.metaOnlyBytes)}</dd>
        </div>
        <div className="rounded-lg bg-destructive/10 p-3">
          <dt className="text-xs text-destructive/80">{t.media.alreadyLost}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-destructive">
            {usage.expiredCount.toLocaleString("es-AR")}
          </dd>
          <dd className="text-xs text-destructive/80">{formatBytes(usage.expiredBytes)}</dd>
        </div>
      </dl>

      {usage.atRiskCount > 0 && (
        <div className="mt-3 rounded-lg bg-primary/5 p-3">
          <p className="text-sm text-foreground">
            {t.media.rescueBefore}{" "}
            <strong>
              {t.media.filesCount.replace("{count}", usage.atRiskCount.toLocaleString("es-AR"))}
            </strong>{" "}
            {t.media.rescueAfter}
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/settings/billing">{t.media.rescueCta}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function KindBreakdown({ usage }: { usage: MediaUsage }) {
  const { t } = useTranslations();
  const kindLabels = useMediaKindLabels();

  if (!usage.byKind.length) return null;

  const total = usage.byKind.reduce((sum, row) => sum + row.bytes, 0) || 1;

  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 text-base font-semibold">{t.media.byKind}</h3>
      <ul className="space-y-2.5">
        {[...usage.byKind]
          .sort((a, b) => b.bytes - a.bytes)
          .map((row) => (
            <li key={row.kind}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span>{kindLabels[row.kind]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {row.count.toLocaleString("es-AR")} · {formatBytes(row.bytes)}
                </span>
              </div>
              <Progress value={(row.bytes / total) * 100} className="h-1.5" />
            </li>
          ))}
      </ul>
    </section>
  );
}
