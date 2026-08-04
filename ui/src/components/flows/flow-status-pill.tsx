"use client";

// Estado de un flujo (listado y builder) sobre el StatusPill del sistema.

import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { FlowStatus } from "@/types";

const TONES: Record<FlowStatus, StatusTone> = {
  draft: "neutral",
  published: "primary",
  paused: "warning",
  archived: "neutral",
};

export function FlowStatusPill({ status, version }: { status: FlowStatus; version?: number | null }) {
  const { t } = useTranslations();
  const labels: Record<FlowStatus, string> = {
    draft: t.flows.statusDraft,
    published: t.flows.statusPublished,
    paused: t.flows.statusPaused,
    archived: t.flows.statusArchived,
  };
  return (
    <StatusPill tone={TONES[status] ?? "neutral"}>
      {labels[status] ?? t.flows.statusDraft}
      {version != null && status !== "draft" ? ` · v${version}` : ""}
    </StatusPill>
  );
}
