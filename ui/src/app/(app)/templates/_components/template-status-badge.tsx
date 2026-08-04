"use client";

import { StatusDot, StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { TemplateQuality, TemplateStatus } from "@/types";

export const TEMPLATE_STATUS_TONES: Record<TemplateStatus, StatusTone> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  paused: "neutral",
  disabled: "neutral",
  draft: "neutral",
};

export function useTemplateStatusLabels(): Record<TemplateStatus, string> {
  const { t } = useTranslations();
  return {
    draft: t.templates.statusDraft,
    pending: t.templates.statusPending,
    approved: t.templates.statusApproved,
    rejected: t.templates.statusRejected,
    paused: t.templates.statusPaused,
    disabled: t.templates.statusDisabled,
  };
}

export function TemplateStatusBadge({ status, className }: { status: TemplateStatus; className?: string }) {
  const labels = useTemplateStatusLabels();
  return (
    <StatusPill tone={TEMPLATE_STATUS_TONES[status]} className={className}>
      {labels[status]}
    </StatusPill>
  );
}

const QUALITY_TONES: Record<
  Exclude<TemplateQuality, "unknown">,
  { tone: StatusTone; labelKey: "qualityGreen" | "qualityYellow" | "qualityRed" }
> = {
  green: { tone: "success", labelKey: "qualityGreen" },
  yellow: { tone: "warning", labelKey: "qualityYellow" },
  red: { tone: "danger", labelKey: "qualityRed" },
};

export function TemplateQualityIndicator({ quality }: { quality: TemplateQuality }) {
  const { t } = useTranslations();
  if (quality === "unknown") return <span className="text-muted-foreground">—</span>;
  const { tone, labelKey } = QUALITY_TONES[quality];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <StatusDot tone={tone} />
      {t.templates[labelKey]}
    </span>
  );
}
