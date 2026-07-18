"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { CampaignStatus } from "@/types";

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
  scheduled: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function useCampaignStatusLabels(): Record<CampaignStatus, string> {
  const { t } = useTranslations();
  return {
    draft: t.campaigns.statusDraft,
    scheduled: t.campaigns.statusScheduled,
    running: t.campaigns.statusRunning,
    paused: t.campaigns.statusPaused,
    completed: t.campaigns.statusCompleted,
    cancelled: t.campaigns.statusCancelled,
    failed: t.campaigns.statusFailed,
  };
}

export function CampaignStatusPill({ status, className }: { status: CampaignStatus; className?: string }) {
  const labels = useCampaignStatusLabels();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CAMPAIGN_STATUS_COLORS[status],
        className
      )}
    >
      {status === "running" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {labels[status]}
    </span>
  );
}
