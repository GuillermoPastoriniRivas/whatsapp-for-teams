"use client";

import { CheckCheck, Eye, MessageCircleReply, Send, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { Campaign, CampaignStats } from "@/types";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function StatTiles({ campaign, stats }: { campaign: Campaign; stats: CampaignStats | null }) {
  const { t } = useTranslations();
  const { counts } = campaign;
  // Delivered/read are cumulative stages: a read message was also delivered.
  const reached = counts.delivered + counts.read;
  const attempted = counts.sent + reached + counts.failed;

  const tiles = [
    {
      label: t.campaigns.statSent,
      icon: Send,
      value: `${attempted}`,
      sub: `/ ${counts.total}`,
      accent: "",
    },
    {
      label: t.campaigns.statDelivered,
      icon: CheckCheck,
      value: `${reached}`,
      sub: stats ? pct(stats.deliveredRate) : undefined,
      accent: "",
    },
    {
      label: t.campaigns.statRead,
      icon: Eye,
      value: `${counts.read}`,
      sub: stats ? pct(stats.readRate) : undefined,
      accent: "",
    },
    {
      label: t.campaigns.statReplied,
      icon: MessageCircleReply,
      value: `${counts.replied}`,
      sub: stats ? pct(stats.responseRate) : undefined,
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t.campaigns.statFailed,
      icon: XCircle,
      value: `${counts.failed}`,
      accent: counts.failed > 0 ? "text-destructive" : "",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ label, icon: Icon, value, sub, accent }) => (
        <div key={label} className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5" />
            <span className="text-[11px] font-medium">{label}</span>
          </div>
          <p className={cn("mt-1 text-xl font-bold", accent)}>
            {value}
            {sub && <span className="ml-1 text-xs font-normal text-muted-foreground">{sub}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}
