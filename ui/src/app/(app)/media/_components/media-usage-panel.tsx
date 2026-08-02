"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes, MEDIA_KIND_LABELS } from "@/lib/media";
import { cn } from "@/lib/utils";
import { CloudOff, HardDrive, ShieldCheck, TriangleAlert } from "lucide-react";
import type { MediaUsage } from "@/types";

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
  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <header className="mb-2 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <TriangleAlert className="h-4.5 w-4.5 text-amber-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">Almacenamiento sin configurar</h3>
          <p className="text-[13px] text-muted-foreground">
            Tu plan incluye la biblioteca, pero este entorno no tiene dónde guardar los archivos.
            Mientras tanto funciona en modo WhatsApp: se pierden a los 30 días.
          </p>
        </div>
      </header>
      <p className="rounded-lg bg-background/60 px-3 py-2 font-mono text-[12px] text-muted-foreground">
        MEDIA_S3_BUCKET=… <span className="font-sans">(producción)</span>
        <br />
        MEDIA_LOCAL_PATH=./.media-storage <span className="font-sans">(desarrollo)</span>
      </p>
    </section>
  );
}

/** Plan pago: cuánto ocupa y cuánto queda. */
function StoredSummary({ usage }: { usage: MediaUsage }) {
  const unlimited = usage.quotaBytes <= 0;
  const percent = usage.usedPercent ?? 0;
  const nearLimit = percent >= 80;

  return (
    <section className="rounded-xl border border-border p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <HardDrive className="h-4.5 w-4.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">Almacenamiento</h3>
          <p className="text-[13px] text-muted-foreground">
            {formatBytes(usage.storedBytes)}
            {unlimited ? " usados · sin límite" : ` de ${formatBytes(usage.quotaBytes)}`} ·{" "}
            {usage.storedCount.toLocaleString("es-AR")} archivos
          </p>
        </div>
      </header>

      {!unlimited && (
        <Progress
          value={percent}
          indicatorClassName={cn(nearLimit && "bg-amber-500", percent >= 100 && "bg-destructive")}
        />
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        {usage.retentionDays < 0
          ? "Tus archivos se guardan para siempre."
          : `Tus archivos se guardan ${usage.retentionDays} días.`}
      </p>

      {nearLimit && !unlimited && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-[13px] text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Estás usando el {percent}% de tu espacio. Liberá archivos o{" "}
            <Link href="/settings/billing" className="font-medium underline">
              ampliá tu plan
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
  return (
    <section className="rounded-xl border border-border p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <CloudOff className="h-4.5 w-4.5 text-amber-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">Tus archivos viven en WhatsApp</h3>
          <p className="text-[13px] text-muted-foreground">
            WhatsApp los guarda 30 días y después los descarta. Nosotros todavía no los estamos
            guardando.
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-[12px] text-muted-foreground">Disponibles ahora</dt>
          <dd className="text-[20px] font-semibold tabular-nums">
            {usage.metaOnlyCount.toLocaleString("es-AR")}
          </dd>
          <dd className="text-[12px] text-muted-foreground">{formatBytes(usage.metaOnlyBytes)}</dd>
        </div>
        <div className="rounded-lg bg-destructive/10 p-3">
          <dt className="text-[12px] text-destructive/80">Ya se perdieron</dt>
          <dd className="text-[20px] font-semibold tabular-nums text-destructive">
            {usage.expiredCount.toLocaleString("es-AR")}
          </dd>
          <dd className="text-[12px] text-destructive/80">{formatBytes(usage.expiredBytes)}</dd>
        </div>
      </dl>

      {usage.atRiskCount > 0 && (
        <div className="mt-3 rounded-lg bg-primary/5 p-3">
          <p className="text-[13px] text-foreground">
            Si activás la biblioteca ahora, rescatamos{" "}
            <strong>{usage.atRiskCount.toLocaleString("es-AR")} archivos</strong> de los últimos 30
            días. Después de ese plazo ya no se pueden recuperar.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/settings/billing">Guardar mis archivos</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function KindBreakdown({ usage }: { usage: MediaUsage }) {
  if (!usage.byKind.length) return null;

  const total = usage.byKind.reduce((sum, row) => sum + row.bytes, 0) || 1;

  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-3 text-[14px] font-semibold">Por tipo</h3>
      <ul className="space-y-2.5">
        {[...usage.byKind]
          .sort((a, b) => b.bytes - a.bytes)
          .map((row) => (
            <li key={row.kind}>
              <div className="mb-1 flex items-baseline justify-between text-[13px]">
                <span>{MEDIA_KIND_LABELS[row.kind].es}</span>
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
