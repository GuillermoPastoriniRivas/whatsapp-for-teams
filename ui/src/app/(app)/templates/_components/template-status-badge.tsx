"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { TemplateQuality, TemplateStatus } from "@/types";

export const TEMPLATE_STATUS_COLORS: Record<TemplateStatus, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  paused: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  disabled: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
};

export function TemplateStatusBadge({ status, className }: { status: TemplateStatus; className?: string }) {
  const { t } = useTranslations();
  const labels: Record<TemplateStatus, string> = {
    draft: t.templates.statusDraft,
    pending: t.templates.statusPending,
    approved: t.templates.statusApproved,
    rejected: t.templates.statusRejected,
    paused: t.templates.statusPaused,
    disabled: t.templates.statusDisabled,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TEMPLATE_STATUS_COLORS[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
}

const QUALITY_DOTS: Record<Exclude<TemplateQuality, "unknown">, { dot: string; labelKey: "qualityGreen" | "qualityYellow" | "qualityRed" }> = {
  green: { dot: "bg-green-500", labelKey: "qualityGreen" },
  yellow: { dot: "bg-amber-500", labelKey: "qualityYellow" },
  red: { dot: "bg-red-500", labelKey: "qualityRed" },
};

export function TemplateQualityIndicator({ quality }: { quality: TemplateQuality }) {
  const { t } = useTranslations();
  if (quality === "unknown") return <span className="text-muted-foreground">—</span>;
  const { dot, labelKey } = QUALITY_DOTS[quality];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-2 rounded-full", dot)} />
      {t.templates[labelKey]}
    </span>
  );
}
