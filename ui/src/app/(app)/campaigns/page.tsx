"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Loader2, Megaphone, MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RightPanel } from "@/components/layout/right-panel";
import { CampaignStatusPill, CAMPAIGN_STATUS_COLORS, useCampaignStatusLabels } from "./_components/campaign-status-pill";
import { CampaignWizard } from "./_components/campaign-wizard";
import { useCampaignStore } from "@/stores/campaign.store";
import type { CampaignProgressEvent } from "@/stores/campaign.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types";

const STATUS_TABS: (CampaignStatus | "")[] = ["", "draft", "scheduled", "running", "paused", "completed", "cancelled", "failed"];

// campaign.counts son contadores ACUMULATIVOS por etapa: sent ya incluye a los
// que después fueron entregados/leídos, así que no se suman entre sí.
export function campaignProcessed(campaign: Campaign): number {
  const { sent, failed, skipped } = campaign.counts;
  return sent + failed + skipped;
}

export function campaignProgressPct(campaign: Campaign): number {
  const { total } = campaign.counts;
  if (!total) return 0;
  return Math.min(100, (campaignProcessed(campaign) / total) * 100);
}

export default function CampaignsPage() {
  const { campaigns, meta, statusFilter, isLoading, fetch, setStatusFilter, start, pause, resume, cancel, remove, applyProgress } =
    useCampaignStore();
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();
  const { t } = useTranslations();
  const statusLabels = useCampaignStatusLabels();
  const isAdmin = agent?.role === "admin";

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Campaign | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (event: CampaignProgressEvent) => applyProgress(event);
    socket.on("campaign.progress", handler);
    return () => {
      socket.off("campaign.progress", handler);
    };
  }, [applyProgress]);

  const countByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of campaigns) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, [campaigns]);

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setEditingDraft(null);
  };

  return (
    <div className="flex h-full">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-b px-4 py-3 md:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">{t.campaigns.title}</h1>
              <p className="text-xs text-muted-foreground">{t.campaigns.subtitle}</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="md:hidden">
                <Link href="/templates">
                  <LayoutTemplate className="size-4" />
                  {t.campaigns.viewTemplates}
                </Link>
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="size-4" />
                  {t.campaigns.newCampaign}
                </Button>
              )}
            </div>
          </div>

          {/* Status pills */}
          <div className="scrollbar-hide -mb-1 flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_TABS.map((status) => {
              const isActive = statusFilter === status;
              const count = status ? (countByStatus[status] ?? 0) : campaigns.length;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive && status
                      ? CAMPAIGN_STATUS_COLORS[status]
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {status ? statusLabels[status] : t.campaigns.filterAll}
                  <span className={cn("text-[10px] font-normal", isActive ? "opacity-80" : "opacity-60")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          {isLoading && campaigns.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Megaphone className="mb-2 size-12 opacity-40" />
              <p className="text-sm">{t.campaigns.noCampaigns}</p>
              {isAdmin && <p className="mt-1 text-xs">{t.campaigns.noCampaignsHint}</p>}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.campaigns.name}</TableHead>
                      <TableHead>{t.templates.status}</TableHead>
                      <TableHead className="w-48">{t.campaigns.progress}</TableHead>
                      <TableHead>{t.campaigns.replied}</TableHead>
                      <TableHead>{t.campaigns.date}</TableHead>
                      {isAdmin && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow
                        key={campaign.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                      >
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <CampaignStatusPill status={campaign.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={campaignProgressPct(campaign)} className="h-1.5 flex-1" />
                            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                              {campaignProcessed(campaign)}/{campaign.counts.total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {campaign.counts.replied}
                          {campaign.counts.total > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              ({Math.round((campaign.counts.replied / campaign.counts.total) * 100)}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(campaign.scheduledAt ?? campaign.createdAt).toLocaleDateString()}
                        </TableCell>
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <CampaignActions
                              campaign={campaign}
                              onEdit={() => {
                                setEditingDraft(campaign);
                                setWizardOpen(true);
                              }}
                              onAction={runAction}
                              actions={{ start, pause, resume, cancel, remove }}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{campaign.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(campaign.scheduledAt ?? campaign.createdAt).toLocaleDateString()}
                        </p>
                      </Link>
                      {isAdmin && (
                        <CampaignActions
                          campaign={campaign}
                          onEdit={() => {
                            setEditingDraft(campaign);
                            setWizardOpen(true);
                          }}
                          onAction={runAction}
                          actions={{ start, pause, resume, cancel, remove }}
                        />
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <CampaignStatusPill status={campaign.status} />
                      <span className="text-[11px] text-muted-foreground">
                        {t.campaigns.replied}: {campaign.counts.replied}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={campaignProgressPct(campaign)} className="h-1.5 flex-1" />
                      <span className="text-[11px] text-muted-foreground">
                        {campaignProcessed(campaign)}/{campaign.counts.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {meta.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => fetch(meta.page - 1)}>
                    {t.contacts.previous}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {meta.page} / {meta.pages}
                  </span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => fetch(meta.page + 1)}>
                    {t.contacts.next}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <RightPanel open={wizardOpen} onClose={closeWizard}>
        {wizardOpen && (
          <CampaignWizard
            key={editingDraft?.id ?? "new"}
            draft={editingDraft ?? undefined}
            onDone={(campaignId) => {
              closeWizard();
              router.push(`/campaigns/${campaignId}`);
            }}
            onCancel={closeWizard}
          />
        )}
      </RightPanel>
    </div>
  );
}

interface CampaignActionsProps {
  campaign: Campaign;
  onEdit: () => void;
  onAction: (action: () => Promise<unknown>) => void;
  actions: {
    start: (id: string) => Promise<Campaign>;
    pause: (id: string) => Promise<Campaign>;
    resume: (id: string) => Promise<Campaign>;
    cancel: (id: string) => Promise<Campaign>;
    remove: (id: string) => Promise<void>;
  };
}

function CampaignActions({ campaign, onEdit, onAction, actions }: CampaignActionsProps) {
  const { t } = useTranslations();
  const { status, id } = campaign;

  const items: Array<{ label: string; destructive?: boolean; onSelect: () => void }> = [];
  if (status === "draft") {
    items.push({ label: t.campaigns.edit, onSelect: onEdit });
    items.push({ label: t.campaigns.start, onSelect: () => onAction(() => actions.start(id)) });
  }
  if (status === "running") items.push({ label: t.campaigns.pause, onSelect: () => onAction(() => actions.pause(id)) });
  if (status === "paused") items.push({ label: t.campaigns.resume, onSelect: () => onAction(() => actions.resume(id)) });
  if (["scheduled", "running", "paused"].includes(status)) {
    items.push({
      label: t.campaigns.cancel,
      destructive: true,
      onSelect: () => {
        if (confirm(t.campaigns.confirmCancel)) onAction(() => actions.cancel(id));
      },
    });
  }
  if (["draft", "cancelled"].includes(status)) {
    items.push({
      label: t.campaigns.delete,
      destructive: true,
      onSelect: () => {
        if (confirm(t.campaigns.confirmDelete)) onAction(() => actions.remove(id));
      },
    });
  }

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} variant={item.destructive ? "destructive" : "default"} onSelect={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
