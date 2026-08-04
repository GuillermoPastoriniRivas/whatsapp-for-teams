"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { toast } from "@/lib/toast";
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
  const confirm = useConfirm();
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
      // No mergear event.counts: son los contadores acumulativos del cache;
      // las tarjetas se alimentan del refetch de stats (fuente de verdad)
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              ...(event.status ? { status: event.status } : {}),
              ...(event.failureReason !== undefined ? { failureReason: event.failureReason } : {}),
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
    if (
      action === "cancel" &&
      !(await confirm({ title: t.campaigns.confirmCancel, confirmLabel: t.campaigns.cancel, destructive: true }))
    ) {
      return;
    }
    try {
      const updated = await api.post<Campaign>(`/campaigns/${campaignId}/${action}`);
      setCampaign(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.genericError);
    }
  };

  if (loading) {
    return <LoadingState className="h-full" />;
  }

  if (notFound || !campaign) {
    return (
      <EmptyState
        className="h-full"
        icon={Megaphone}
        title={t.campaigns.notFound}
        action={
          <Button asChild variant="outline">
            <Link href="/campaigns">{t.campaigns.backToList}</Link>
          </Button>
        }
      />
    );
  }

  // stats.counts = estados exclusivos por destinatario (fuente de verdad);
  // fallback: contadores acumulativos del campaign (sent ya incluye etapas posteriores)
  const sc = stats?.counts;
  const processed = sc
    ? sc.sent + sc.delivered + sc.read + sc.failed + sc.skipped
    : campaign.counts.sent + campaign.counts.failed + campaign.counts.skipped;
  const totalCount = sc?.total ?? campaign.counts.total;
  const progressPct = totalCount ? Math.min(100, (processed / totalCount) * 100) : 0;

  return (
    <PageShell>
      <PageHeader
        title={campaign.name}
        backHref="/campaigns"
        actions={
          isAdmin && (
            <>
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
                <Button size="sm" variant="destructive" onClick={() => runAction("cancel")}>
                  {t.campaigns.cancel}
                </Button>
              )}
            </>
          )
        }
      >
        <div className="flex items-center gap-2">
          <CampaignStatusPill status={campaign.status} />
          {campaign.scheduledAt && campaign.status === "scheduled" && (
            <span className="text-xs text-muted-foreground">
              {t.campaigns.scheduleFor}: {new Date(campaign.scheduledAt).toLocaleString()}
            </span>
          )}
        </div>
      </PageHeader>

      <PageContent className="space-y-6">
        {campaign.failureReason && ["failed", "paused"].includes(campaign.status) && (
          <InlineNotice variant="error">
            {t.campaigns.failureBanner}: {campaign.failureReason}
          </InlineNotice>
        )}

        <StatTiles campaign={campaign} stats={stats} />

        {/* Overall progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {processed}/{totalCount} {t.campaigns.progressLabel}
            </span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} />
        </div>

        {/* Failure breakdown */}
        {stats && stats.failureBreakdown.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold">{t.campaigns.failureBreakdown}</h2>
            <div className="divide-y rounded-xl border">
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
      </PageContent>
    </PageShell>
  );
}
