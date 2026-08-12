"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useConversationStore } from "@/stores/conversation.store";
import type { AdPerformanceEntry, AdPerformanceResponse } from "@/types";

interface Props {
  phoneId: string;
  rangeDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function creativeTitle(entry: AdPerformanceEntry, fallback: string): string {
  return entry.headline ?? entry.body ?? fallback;
}

export function AdPerformance({ phoneId, rangeDays }: Props) {
  const { t } = useTranslations();
  const router = useRouter();
  const setAdFilter = useConversationStore((state) => state.setAdFilter);
  const [data, setData] = useState<AdPerformanceResponse | null>(null);

  useEffect(() => {
    if (!phoneId) return;
    let cancelled = false;
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * DAY_MS);
    api
      .get<AdPerformanceResponse>(
        `/analytics/ads?start=${start.toISOString()}&end=${end.toISOString()}&phoneNumberId=${phoneId}`
      )
      .then((result) => !cancelled && setData(result))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [phoneId, rangeDays]);

  const money = (value: number | null, currency: string | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? data?.totals.currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const openConversations = (sourceId: string) => {
    setAdFilter(sourceId);
    router.push("/conversations");
  };

  const entries = data?.entries ?? [];

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Megaphone className="size-4" />
          {t.ads.sectionTitle}
        </h2>
        <p className="text-xs text-muted-foreground">{t.ads.sectionHint}</p>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t.ads.noAds}</p>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">{t.ads.colCreative}</th>
                  <th className="pb-2 text-right font-medium">{t.ads.colConversations}</th>
                  <th className="pb-2 text-right font-medium">{t.ads.colContacts}</th>
                  <th className="pb-2 text-right font-medium">{t.ads.colAssigned}</th>
                  <th className="pb-2 text-right font-medium">{t.ads.colUnread}</th>
                  <th className="pb-2 text-right font-medium">{t.ads.colMessages}</th>
                  <th className="pb-2 text-right font-medium">{t.ads.colCost}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.sourceId} className="border-b last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        {entry.thumbnailUrl ? (
                          <img src={entry.thumbnailUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Megaphone className="size-3.5 text-muted-foreground" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate">{creativeTitle(entry, t.ads.untitledCreative)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {entry.sourceType === "post" ? t.ads.originPost : t.ads.originAd} · {entry.sourceId}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{entry.conversations.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">{entry.contacts.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">{entry.assigned.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {entry.unread > 0 ? (
                        <span className="font-semibold text-destructive">{entry.unread.toLocaleString()}</span>
                      ) : (
                        entry.unread.toLocaleString()
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{entry.messagesBillable.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">{money(entry.cost, entry.currency)}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openConversations(entry.sourceId)}>
                        {t.ads.viewChats}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 md:hidden">
            {entries.map((entry) => (
              <div key={entry.sourceId} className="space-y-2 rounded-xl p-3 ring-1 ring-foreground/10">
                <div className="flex items-start gap-2">
                  {entry.thumbnailUrl ? (
                    <img src={entry.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Megaphone className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{creativeTitle(entry, t.ads.untitledCreative)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.sourceType === "post" ? t.ads.originPost : t.ads.originAd} · {entry.sourceId}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.ads.colConversations}</p>
                    <p className="text-sm font-semibold tabular-nums">{entry.conversations.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.ads.colUnread}</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        entry.unread > 0 && "text-destructive"
                      )}
                    >
                      {entry.unread.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.ads.colCost}</p>
                    <p className="text-sm font-semibold tabular-nums">{money(entry.cost, entry.currency)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openConversations(entry.sourceId)}
                >
                  {t.ads.viewChats}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
