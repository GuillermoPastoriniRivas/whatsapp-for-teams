"use client";

import { useEffect, useMemo, useState } from "react";

import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPill } from "@/components/ui/filter-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { SeriesChart, type SeriesPoint } from "@/components/analytics/series-chart";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { PhoneNumber } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

interface AnalyticsResponse {
  messaging: Array<{ start: string; end: string; sent: number; delivered: number }>;
  /** `false` = Meta no devolvió costo; no es que el costo sea cero. */
  costAvailable: boolean;
  totals: {
    sent: number;
    delivered: number;
    conversations: number;
    cost: number;
    currency: string | null;
    costByCategory: Array<{ category: string; conversations: number; cost: number }>;
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

  const points: SeriesPoint[] = useMemo(
    () =>
      (data?.messaging ?? []).map((point) => ({
        label: new Date(point.start).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }),
        values: [point.sent, point.delivered],
      })),
    [data]
  );

  const categoryLabel = (category: string): string => {
    const key = category.toUpperCase();
    if (key === "MARKETING") return t.analytics.categoryMarketing;
    if (key === "UTILITY") return t.analytics.categoryUtility;
    if (key === "AUTHENTICATION") return t.analytics.categoryAuthentication;
    if (key === "SERVICE") return t.analytics.categoryService;
    return t.analytics.categoryUnknown;
  };

  const money = (value: number) =>
    `${data?.totals.currency ? `${data.totals.currency} ` : ""}${value.toFixed(2)}`;

  const categories = data?.totals.costByCategory ?? [];
  const maxCost = Math.max(0.0001, ...categories.map((c) => c.cost));

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
                  {/* Sin datos de Meta se muestra un guion, no "0.00": el costo
                      cero y el costo desconocido no son lo mismo. */}
                  <StatTile
                    label={t.analytics.cost}
                    value={data.costAvailable ? money(data.totals.cost) : "—"}
                    hint={data.costAvailable ? undefined : t.analytics.costUnavailable}
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

                {categories.length > 0 && (
                  <Card className="space-y-3 p-4">
                    <div>
                      <h2 className="text-base font-semibold">{t.analytics.costTitle}</h2>
                      <p className="text-xs text-muted-foreground">{t.analytics.costHint}</p>
                    </div>
                    {/* Barras con etiqueta directa: no hace falta leyenda ni
                        tabla aparte, cada barra dice qué es y cuánto. */}
                    <div className="space-y-2.5">
                      {categories.map((entry) => (
                        <div key={entry.category} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: CATEGORY_COLOR[entry.category.toUpperCase()] ?? "var(--chart-5)" }}
                                aria-hidden
                              />
                              {categoryLabel(entry.category)}
                            </span>
                            <span className="tabular-nums">
                              {money(entry.cost)}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {entry.conversations.toLocaleString()}
                              </span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(2, (entry.cost / maxCost) * 100)}%`,
                                backgroundColor: CATEGORY_COLOR[entry.category.toUpperCase()] ?? "var(--chart-5)",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
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
