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
  // stats.counts viene de la agregación por destinatario (estados EXCLUSIVOS:
  // un leído cuenta solo como leído) — la fuente de verdad. El fallback
  // campaign.counts son contadores ACUMULATIVOS por etapa (sent incluye a los
  // que después fueron entregados/leídos), así que la aritmética difiere.
  const s = stats?.counts;
  const c = campaign.counts;
  const attempted = s ? s.sent + s.delivered + s.read + s.failed : c.sent + c.failed;
  const reached = s ? s.delivered + s.read : c.delivered;
  const read = s ? s.read : c.read;
  const replied = s ? s.replied : c.replied;
  const failed = s ? s.failed : c.failed;
  const total = s ? s.total : c.total;

  const tiles = [
    {
      label: t.campaigns.statSent,
      icon: Send,
      value: `${attempted}`,
      sub: `/ ${total}`,
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
      value: `${read}`,
      sub: stats ? pct(stats.readRate) : undefined,
      accent: "",
    },
    {
      label: t.campaigns.statReplied,
      icon: MessageCircleReply,
      value: `${replied}`,
      sub: stats ? pct(stats.responseRate) : undefined,
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t.campaigns.statFailed,
      icon: XCircle,
      value: `${failed}`,
      accent: failed > 0 ? "text-destructive" : "",
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
