"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Megaphone, MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { FilterPill } from "@/components/ui/filter-pill";
import { Pagination } from "@/components/ui/pagination";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
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
import { CampaignStatusPill, useCampaignStatusLabels } from "./_components/campaign-status-pill";
import { CampaignWizard } from "./_components/campaign-wizard";
import { useCampaignStore } from "@/stores/campaign.store";
import type { CampaignProgressEvent } from "@/stores/campaign.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { getSocket } from "@/lib/socket";
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
      toast.error(err instanceof Error ? err.message : t.common.genericError);
    }
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setEditingDraft(null);
  };

  return (
    <div className="flex h-full">
      <PageShell className="min-w-0 flex-1">
        <PageHeader
          title={t.campaigns.title}
          subtitle={t.campaigns.subtitle}
          actions={
            <>
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
            </>
          }
        >
          {STATUS_TABS.map((status) => (
            <FilterPill
              key={status}
              active={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              count={status ? (countByStatus[status] ?? 0) : campaigns.length}
            >
              {status ? statusLabels[status] : t.campaigns.filterAll}
            </FilterPill>
          ))}
        </PageHeader>

        <PageContent>
          {isLoading && campaigns.length === 0 ? (
            <LoadingState />
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={t.campaigns.noCampaigns}
              description={isAdmin ? t.campaigns.noCampaignsHint : undefined}
            />
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
                            <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
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
                  <div key={campaign.id} className="rounded-xl border p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{campaign.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
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
                      <span className="text-xs text-muted-foreground">
                        {t.campaigns.replied}: {campaign.counts.replied}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={campaignProgressPct(campaign)} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {campaignProcessed(campaign)}/{campaign.counts.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination page={meta.page} pages={meta.pages} onPageChange={(page) => fetch(page)} />
            </>
          )}
        </PageContent>
      </PageShell>

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
  const confirm = useConfirm();
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
      onSelect: async () => {
        if (await confirm({ title: t.campaigns.confirmCancel, confirmLabel: t.campaigns.cancel, destructive: true })) {
          onAction(() => actions.cancel(id));
        }
      },
    });
  }
  if (["draft", "cancelled"].includes(status)) {
    items.push({
      label: t.campaigns.delete,
      destructive: true,
      onSelect: async () => {
        if (await confirm({ title: t.campaigns.confirmDelete, confirmLabel: t.common.delete, destructive: true })) {
          onAction(() => actions.remove(id));
        }
      },
    });
  }

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
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
