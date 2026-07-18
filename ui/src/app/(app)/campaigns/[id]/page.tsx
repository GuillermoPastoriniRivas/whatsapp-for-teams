"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { InlineNotice } from "@/components/shared/inline-notice";
import { CampaignStatusPill } from "../_components/campaign-status-pill";
import { StatTiles } from "../_components/stat-tiles";
import { RecipientsTable } from "../_components/recipients-table";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Campaign, CampaignStats } from "@/types";
import type { CampaignProgressEvent } from "@/stores/campaign.store";

const REFRESH_DEBOUNCE_MS = 3000;

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const isAdmin = agent?.role === "admin";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipientsRefreshKey, setRecipientsRefreshKey] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [campaignRes, statsRes] = await Promise.all([
        api.get<Campaign>(`/campaigns/${campaignId}`),
        api.get<CampaignStats>(`/campaigns/${campaignId}/stats`),
      ]);
      setCampaign(campaignRes);
      setStats(statsRes);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live progress: merge counts immediately; refetch stats + recipients debounced
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (event: CampaignProgressEvent) => {
      if (event.campaignId !== campaignId) return;
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              ...(event.status ? { status: event.status } : {}),
              ...(event.failureReason !== undefined ? { failureReason: event.failureReason } : {}),
              counts: {
                ...prev.counts,
                ...(event.counts ?? {}),
                ...(event.replied !== undefined ? { replied: event.replied } : {}),
              },
            }
          : prev
      );
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        api.get<CampaignStats>(`/campaigns/${campaignId}/stats`).then(setStats).catch(() => {});
        setRecipientsRefreshKey((k) => k + 1);
      }, REFRESH_DEBOUNCE_MS);
    };

    socket.on("campaign.progress", handler);
    return () => {
      socket.off("campaign.progress", handler);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [campaignId]);

  const runAction = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (action === "cancel" && !confirm(t.campaigns.confirmCancel)) return;
    try {
      const updated = await api.post<Campaign>(`/campaigns/${campaignId}/${action}`);
      setCampaign(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">{t.campaigns.notFound}</p>
        <Link href="/campaigns" className="text-sm font-medium text-primary hover:underline">
          {t.campaigns.backToList}
        </Link>
      </div>
    );
  }

  const { counts } = campaign;
  const processed = counts.sent + counts.delivered + counts.read + counts.failed + counts.skipped;
  const progressPct = counts.total ? (processed / counts.total) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/campaigns" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold">{campaign.name}</h1>
              <CampaignStatusPill status={campaign.status} />
            </div>
            {campaign.scheduledAt && campaign.status === "scheduled" && (
              <p className="text-xs text-muted-foreground">
                {t.campaigns.scheduleFor}: {new Date(campaign.scheduledAt).toLocaleString()}
              </p>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              {campaign.status === "draft" && (
                <Button size="sm" onClick={() => runAction("start")}>
                  {t.campaigns.start}
                </Button>
              )}
              {campaign.status === "running" && (
                <Button size="sm" variant="outline" onClick={() => runAction("pause")}>
                  {t.campaigns.pause}
                </Button>
              )}
              {campaign.status === "paused" && (
                <Button size="sm" onClick={() => runAction("resume")}>
                  {t.campaigns.resume}
                </Button>
              )}
              {["scheduled", "running", "paused"].includes(campaign.status) && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => runAction("cancel")}>
                  {t.campaigns.cancel}
                </Button>
              )}
            </div>
          )}
        </div>
        {campaign.failureReason && ["failed", "paused"].includes(campaign.status) && (
          <InlineNotice variant="error" className="mt-2">
            {t.campaigns.failureBanner}: {campaign.failureReason}
          </InlineNotice>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
        <StatTiles campaign={campaign} stats={stats} />

        {/* Overall progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {processed}/{counts.total} {t.campaigns.progressLabel}
            </span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} />
        </div>

        {/* Failure breakdown */}
        {stats && stats.failureBreakdown.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t.campaigns.failureBreakdown}</h2>
            <div className="divide-y rounded-lg border">
              {stats.failureBreakdown.map((failure) => (
                <div key={failure.code} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-muted-foreground">{failure.code}</span> · {failure.title}
                  </span>
                  <span className="ml-2 font-semibold text-destructive">{failure.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <RecipientsTable campaignId={campaignId} refreshKey={recipientsRefreshKey} />
      </div>
    </div>
  );
}
