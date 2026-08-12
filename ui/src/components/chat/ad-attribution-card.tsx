"use client";

import { ExternalLink, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { ConversationAttribution } from "@/types";

interface Props {
  attribution: ConversationAttribution;
}

export function AdAttributionCard({ attribution }: Props) {
  const { t } = useTranslations();
  const isPost = attribution.sourceType === "post";
  const title = attribution.headline ?? attribution.body ?? t.ads.untitledCreative;

  return (
    <div className="space-y-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        {attribution.thumbnailUrl ? (
          <img
            src={attribution.thumbnailUrl}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Megaphone className="size-5 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <Badge variant="secondary" className="gap-1">
            <Megaphone className="size-3" />
            {isPost ? t.ads.originPost : t.ads.originAd}
          </Badge>
          <p className="line-clamp-2 text-sm font-medium">{title}</p>
        </div>
      </div>

      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-baseline justify-between gap-2">
          <dt>{t.ads.sourceId}</dt>
          <dd className="truncate font-mono tabular-nums">{attribution.sourceId}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt>{t.ads.clickedAt}</dt>
          <dd>{new Date(attribution.capturedAt).toLocaleString()}</dd>
        </div>
      </dl>

      {attribution.sourceUrl && (
        <a
          href={attribution.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:underline md:min-h-0"
        >
          <ExternalLink className="size-3.5" />
          {t.ads.openInMeta}
        </a>
      )}
    </div>
  );
}
