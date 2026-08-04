"use client";

import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { CampaignStatus } from "@/types";

export const CAMPAIGN_STATUS_TONES: Record<CampaignStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "scheduled",
  running: "info",
  paused: "warning",
  completed: "success",
  cancelled: "neutral",
  failed: "danger",
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
    <StatusPill tone={CAMPAIGN_STATUS_TONES[status]} pulse={status === "running"} className={className}>
      {labels[status]}
    </StatusPill>
  );
}
