"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { FilterPill } from "@/components/ui/filter-pill";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/spinner";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n/use-translations";
import { identityHandle } from "@/lib/identity";
import { api } from "@/lib/api";
import type { CampaignRecipient, CampaignRecipientStatus, PaginatedResponse } from "@/types";

const STATUS_TABS: (CampaignRecipientStatus | "")[] = ["", "sent", "delivered", "read", "failed", "skipped", "pending"];

const RECIPIENT_STATUS_TONES: Record<CampaignRecipientStatus, StatusTone> = {
  pending: "neutral",
  queued: "neutral",
  sent: "info",
  delivered: "primary",
  read: "success",
  failed: "danger",
  skipped: "neutral",
};

function useRecipientStatusLabels(): Record<CampaignRecipientStatus, string> {
  const { t } = useTranslations();
  return {
    pending: t.campaigns.recipientPending,
    queued: t.campaigns.recipientQueued,
    sent: t.campaigns.recipientSent,
    delivered: t.campaigns.recipientDelivered,
    read: t.campaigns.recipientRead,
    failed: t.campaigns.recipientFailed,
    skipped: t.campaigns.recipientSkipped,
  };
}

function RecipientStatusPill({ status }: { status: CampaignRecipientStatus }) {
  const labels = useRecipientStatusLabels();
  return <StatusPill tone={RECIPIENT_STATUS_TONES[status]}>{labels[status]}</StatusPill>;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function RecipientsTable({ campaignId, refreshKey }: { campaignId: string; refreshKey: number }) {
  const { t } = useTranslations();
  const statusLabels = useRecipientStatusLabels();
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [statusFilter, setStatusFilter] = useState<CampaignRecipientStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (statusFilter) params.set("status", statusFilter);
        const res = await api.get<PaginatedResponse<CampaignRecipient>>(`/campaigns/${campaignId}/recipients?${params}`);
        if (!cancelled) {
          setRecipients(res.data);
          setMeta(res.meta);
        }
      } catch {
        if (!cancelled) setRecipients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, statusFilter, page, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {t.campaigns.recipientsTitle} <span className="font-normal text-muted-foreground">({meta.total})</span>
        </h2>
        <div className="scrollbar-hide -mb-1 flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((status) => (
            <FilterPill
              key={status}
              active={statusFilter === status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {status ? statusLabels[status] : t.campaigns.filterAll}
            </FilterPill>
          ))}
        </div>
      </div>

      {loading && recipients.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.campaigns.recipientContact}</TableHead>
                  <TableHead>{t.campaigns.recipientStatus}</TableHead>
                  <TableHead>{t.campaigns.recipientSentAt}</TableHead>
                  <TableHead>{t.campaigns.recipientReadAt}</TableHead>
                  <TableHead>{t.campaigns.recipientRepliedAt}</TableHead>
                  <TableHead>{t.campaigns.recipientFailure}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell className="font-mono text-xs">{identityHandle(recipient) ?? "—"}</TableCell>
                    <TableCell>
                      <RecipientStatusPill status={recipient.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(recipient.sentAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(recipient.readAt)}</TableCell>
                    <TableCell className="text-xs">
                      {recipient.repliedAt ? (
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium">{formatTime(recipient.repliedAt)}</span>
                          {recipient.conversationId && (
                            <Link
                              href={`/conversations/${recipient.conversationId}`}
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <MessageSquare className="size-3" />
                              {t.campaigns.viewConversation}
                            </Link>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 text-xs text-muted-foreground">
                      {recipient.failureCode ? (
                        <span className="text-destructive">
                          <span className="font-mono">{recipient.failureCode}</span>
                          {recipient.failureReason && ` · ${recipient.failureReason}`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {recipients.map((recipient) => (
              <div key={recipient.id} className="rounded-xl border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{identityHandle(recipient) ?? "—"}</span>
                  <RecipientStatusPill status={recipient.status} />
                </div>
                <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                  <p>
                    {t.campaigns.recipientSentAt}: {formatTime(recipient.sentAt)}
                  </p>
                  {recipient.repliedAt && (
                    <p className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        {t.campaigns.recipientRepliedAt}: {formatTime(recipient.repliedAt)}
                      </span>
                      {recipient.conversationId && (
                        <Link href={`/conversations/${recipient.conversationId}`} className="text-primary hover:underline">
                          {t.campaigns.viewConversation}
                        </Link>
                      )}
                    </p>
                  )}
                  {recipient.failureCode && (
                    <p className="text-destructive">
                      {recipient.failureCode} {recipient.failureReason && `· ${recipient.failureReason}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={meta.page} pages={meta.pages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
