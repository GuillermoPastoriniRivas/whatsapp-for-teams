"use client";

import { useEffect, useMemo, useState } from "react";

import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPill } from "@/components/ui/filter-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { SeriesChart, type SeriesPoint } from "@/components/analytics/series-chart";
import { AdPerformance } from "@/components/analytics/ad-performance";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { PhoneNumber } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/**
 * Las dimensiones que Meta no puede darnos porque no las sabe: quién mandó el
 * mensaje, de qué campaña salió, con qué plantilla. Salen de nuestro ledger.
 */
const GROUPS = ["senderKind", "campaign", "template", "country", "category"] as const;
type Group = (typeof GROUPS)[number];

interface UsageBucket {
  key: string;
  /** Nombre resuelto por el backend. Null = la plantilla o campaña ya no existe. */
  label?: string | null;
  billable: number;
  free: number;
  pending: number;
  failed: number;
  amount: number | null;
  currency: string | null;
}

interface UsageResponse {
  currency: string | null;
  total: UsageBucket;
  buckets: UsageBucket[];
  disclaimer: { chargedBy: "meta"; markup: 0; note: string };
  warnings: string[];
}

/**
 * Volumen según Meta. El costo ya no sale de acá: el de Meta viene por
 * conversación —el modelo que se está yendo— y no sabe quién mandó cada
 * mensaje. Eso lo responde nuestro ledger, en `UsageResponse`.
 */
interface AnalyticsResponse {
  messaging: Array<{ start: string; end: string; sent: number; delivered: number }>;
  totals: {
    sent: number;
    delivered: number;
    conversations: number;
    currency: string | null;
  };
}

/** Orden fijo de la serie categórica: una categoría no cambia de color. */
const CATEGORY_COLOR: Record<string, string> = {
  MARKETING: "var(--chart-1)",
  UTILITY: "var(--chart-2)",
  AUTHENTICATION: "var(--chart-3)",
  SERVICE: "var(--chart-4)",
  UNKNOWN: "var(--chart-5)",
};

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/**
 * Las categorías tienen color fijo —marketing es siempre el mismo— porque el
 * usuario las compara entre períodos. El resto de los agrupados no tiene un
 * orden estable, así que se pintan por posición.
 */
function barColor(group: Group, key: string, index: number): string {
  if (group === "category") return CATEGORY_COLOR[key.toUpperCase()] ?? "var(--chart-5)";
  return CHART_COLORS[index % CHART_COLORS.length];
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslations();
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [phoneId, setPhoneId] = useState<string>("");
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [group, setGroup] = useState<Group>("senderKind");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PhoneNumber[]>("/phone-numbers")
      .then((list) => {
        const active = list.filter((p) => p.status === "active");
        setPhones(active);
        setPhoneId((prev) => prev || active[0]?.id || "");
      })
      .catch(() => setPhones([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!phoneId) return;
    let cancelled = false;
    setLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - range * DAY_MS);
    api
      .get<AnalyticsResponse>(
        `/analytics/phone-numbers/${phoneId}?start=${start.toISOString()}&end=${end.toISOString()}`
      )
      .then((result) => !cancelled && setData(result))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [phoneId, range]);

  // El costo sale de nuestro propio ledger, no de Meta: es lo único que sabe
  // quién mandó cada mensaje y de qué campaña salió. Va aparte del pedido de
  // volumen para que una falla de la API de Meta no se lleve puesto el costo.
  useEffect(() => {
    if (!phoneId) return;
    let cancelled = false;
    const end = new Date();
    const start = new Date(end.getTime() - range * DAY_MS);
    api
      .get<UsageResponse>(
        `/analytics/messages?start=${start.toISOString()}&end=${end.toISOString()}` +
          `&phoneNumberId=${phoneId}&groupBy=${group}`
      )
      .then((result) => !cancelled && setUsage(result))
      .catch(() => !cancelled && setUsage(null));
    return () => {
      cancelled = true;
    };
  }, [phoneId, range, group]);

  const points: SeriesPoint[] = useMemo(
    () =>
      (data?.messaging ?? []).map((point) => ({
        label: new Date(point.start).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }),
        values: [point.sent, point.delivered],
      })),
    [data]
  );

  /**
   * Un mensaje sale fracciones de centavo: con dos decimales fijos todo el
   * desglose daría "0,00" y parecería gratis.
   */
  const ledgerMoney = (value: number | null, currency: string | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? usage?.currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  /** El nombre que resolvió el backend; si no, la clave traducida. */
  const bucketLabel = (bucket: UsageBucket): string => {
    if (bucket.label) return bucket.label;
    const dict = t.analytics as unknown as Record<string, string>;
    return dict[`key_${bucket.key}`] ?? bucket.key;
  };

  const buckets = useMemo(
    () => (usage?.buckets ?? []).slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || b.billable - a.billable),
    [usage]
  );
  const maxAmount = Math.max(0.0001, ...buckets.map((b) => b.amount ?? 0));

  return (
    <PageShell>
      <PageHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />
      <PageContent>
        {phones.length === 0 && !loading ? (
          <EmptyState title={t.analytics.noNumbers} />
        ) : (
          <div className="space-y-4 md:space-y-6">
            {/* Filtros en una sola fila arriba de los gráficos. */}
            <div className="flex flex-wrap items-center gap-2">
              {phones.map((phone) => (
                <FilterPill key={phone.id} active={phone.id === phoneId} onClick={() => setPhoneId(phone.id)}>
                  {phone.label}
                </FilterPill>
              ))}
              <span className="mx-1 hidden h-4 w-px bg-border md:block" />
              {RANGES.map((days) => (
                <FilterPill key={days} active={days === range} onClick={() => setRange(days)}>
                  {days === 7 ? t.analytics.range7 : days === 30 ? t.analytics.range30 : t.analytics.range90}
                </FilterPill>
              ))}
            </div>

            {loading ? (
              <LoadingState className="py-16" />
            ) : !data || points.length === 0 ? (
              <EmptyState title={t.analytics.noData} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile label={t.analytics.sent} value={data.totals.sent.toLocaleString()} />
                  <StatTile label={t.analytics.delivered} value={data.totals.delivered.toLocaleString()} />
                  <StatTile
                    label={t.analytics.conversations}
                    value={data.totals.conversations.toLocaleString()}
                  />
                  {/* El costo sale de nuestro ledger: es lo único que sabe qué
                      se entregó de verdad y quién lo mandó. Sin nada tarifado
                      se muestra un guion, no "0,00" — el costo cero y el costo
                      desconocido no son lo mismo. */}
                  <StatTile
                    label={t.analytics.cost}
                    value={ledgerMoney(usage?.total.amount ?? null, usage?.total.currency ?? null)}
                    hint={t.analytics.costHint}
                  />
                </div>

                <Card className="space-y-3 p-4">
                  <h2 className="text-base font-semibold">{t.analytics.volumeTitle}</h2>
                  <SeriesChart
                    points={points}
                    seriesNames={[t.analytics.sent, t.analytics.delivered]}
                    seriesColors={["var(--chart-1)", "var(--chart-2)"]}
                  />
                </Card>

                <AdPerformance phoneId={phoneId} rangeDays={range} />

                {usage && (
                  <Card className="space-y-3 p-4">
                    <div>
                      <h2 className="text-base font-semibold">{t.analytics.costTitle}</h2>
                      {/* Quién cobra qué va acá arriba, no en letra chica: es el
                          modelo de negocio, no una aclaración legal. */}
                      <p className="text-xs text-muted-foreground">{usage.disclaimer.note}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {GROUPS.map((value) => (
                        <FilterPill key={value} active={group === value} onClick={() => setGroup(value)}>
                          {t.analytics[`group_${value}` as "group_senderKind"]}
                        </FilterPill>
                      ))}
                    </div>

                    {buckets.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">{t.analytics.noCharges}</p>
                    ) : (
                      /* Barras con etiqueta directa: no hace falta leyenda ni
                         tabla aparte, cada barra dice qué es y cuánto. */
                      <div className="space-y-2.5">
                        {buckets.map((bucket, index) => (
                          <div key={bucket.key} className="space-y-1">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: barColor(group, bucket.key, index) }}
                                  aria-hidden
                                />
                                <span className="truncate">{bucketLabel(bucket)}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {ledgerMoney(bucket.amount, bucket.currency)}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {bucket.billable.toLocaleString()}
                                </span>
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(2, ((bucket.amount ?? 0) / maxAmount) * 100)}%`,
                                  backgroundColor: barColor(group, bucket.key, index),
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Un total incompleto tiene que decirlo: mostrar un número
                        redondo cuando falta tarifar la mitad es peor que nada. */}
                    {usage.warnings.map((warning) => (
                      <p key={warning} className="text-xs text-muted-foreground">
                        {warning}
                      </p>
                    ))}
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
