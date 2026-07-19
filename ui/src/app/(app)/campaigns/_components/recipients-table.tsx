"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CampaignRecipient, CampaignRecipientStatus, PaginatedResponse } from "@/types";

const STATUS_TABS: (CampaignRecipientStatus | "")[] = ["", "sent", "delivered", "read", "failed", "skipped", "pending"];

const RECIPIENT_STATUS_COLORS: Record<CampaignRecipientStatus, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
  queued: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delivered: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  read: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  skipped: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function RecipientsTable({ campaignId, refreshKey }: { campaignId: string; refreshKey: number }) {
  const { t } = useTranslations();
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

  const statusLabels: Record<CampaignRecipientStatus, string> = {
    pending: t.campaigns.recipientPending,
    queued: t.campaigns.recipientQueued,
    sent: t.campaigns.recipientSent,
    delivered: t.campaigns.recipientDelivered,
    read: t.campaigns.recipientRead,
    failed: t.campaigns.recipientFailed,
    skipped: t.campaigns.recipientSkipped,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {t.campaigns.recipientsTitle} <span className="font-normal text-muted-foreground">({meta.total})</span>
        </h2>
        <div className="scrollbar-hide -mb-1 flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                statusFilter === status && status
                  ? RECIPIENT_STATUS_COLORS[status]
                  : statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {status ? statusLabels[status] : t.campaigns.filterAll}
            </button>
          ))}
        </div>
      </div>

      {loading && recipients.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
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
                    <TableCell className="font-mono text-xs">+{recipient.waId}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                          RECIPIENT_STATUS_COLORS[recipient.status]
                        )}
                      >
                        {statusLabels[recipient.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(recipient.sentAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(recipient.readAt)}</TableCell>
                    <TableCell className="text-xs">
                      {recipient.repliedAt ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400">{formatTime(recipient.repliedAt)}</span>
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
              <div key={recipient.id} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">+{recipient.waId}</span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      RECIPIENT_STATUS_COLORS[recipient.status]
                    )}
                  >
                    {statusLabels[recipient.status]}
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                  <p>
                    {t.campaigns.recipientSentAt}: {formatTime(recipient.sentAt)}
                  </p>
                  {recipient.repliedAt && (
                    <p className="flex items-center gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400">
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

          {meta.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t.contacts.previous}
              </Button>
              <span className="text-xs text-muted-foreground">
                {meta.page} / {meta.pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                {t.contacts.next}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
