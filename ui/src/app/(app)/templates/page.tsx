"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutTemplate, Loader2, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
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
import { InlineNotice } from "@/components/shared/inline-notice";
import { TemplateEditorPanel } from "./_components/template-editor-panel";
import { TemplateQualityIndicator, TemplateStatusBadge, TEMPLATE_STATUS_COLORS } from "./_components/template-status-badge";
import { useTemplateStore } from "@/stores/template.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import type { MessageTemplate, PhoneNumber, TemplateStatus } from "@/types";
import type { TemplateRealtimeEvent } from "@/stores/template.store";

const STATUS_TABS: (TemplateStatus | "")[] = ["", "approved", "pending", "rejected", "paused", "draft", "disabled"];
// Templates in these states can be edited on Meta (a save sends them back to review)
const EDITABLE_STATUSES: TemplateStatus[] = ["approved", "rejected", "paused"];
// Providers that support Meta template management (twilio/360dialog don't)
export const TEMPLATE_CAPABLE_PROVIDERS = new Set(["meta", "kapso", "demo"]);

export default function TemplatesPage() {
  const { templates, meta, statusFilter, isLoading, fetch, setStatusFilter, setSearch, setPhoneNumberId, remove, sync, applyRealtime } =
    useTemplateStore();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const isAdmin = agent?.role === "admin";

  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch();
    api
      .get<PhoneNumber[]>("/phone-numbers")
      .then((list) => setPhones(list.filter((p) => TEMPLATE_CAPABLE_PROVIDERS.has(p.provider) && p.status === "active")))
      .catch(() => {});
  }, [fetch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  // Live template status/quality updates from Meta webhooks
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (event: TemplateRealtimeEvent) => applyRealtime(event);
    socket.on("template.updated", handler);
    return () => {
      socket.off("template.updated", handler);
    };
  }, [applyRealtime]);

  const countByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tpl of templates) map[tpl.status] = (map[tpl.status] ?? 0) + 1;
    return map;
  }, [templates]);

  const handleSync = async () => {
    const phoneId = selectedPhone || phones[0]?.id;
    if (!phoneId) return;
    setSyncing(true);
    setNotice(null);
    try {
      const synced = await sync(phoneId);
      setNotice({ variant: "success", text: `${synced} ${t.templates.syncResult}` });
    } catch (err) {
      setNotice({ variant: "error", text: err instanceof Error ? err.message : "Error" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (template: MessageTemplate) => {
    if (!confirm(t.templates.confirmDelete)) return;
    try {
      await remove(template.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  };

  const closePanel = () => {
    setEditing(null);
    setCreating(false);
  };

  const panelOpen = creating || !!editing;

  return (
    <div className="flex h-full">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-b px-4 py-3 md:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">{t.templates.title}</h1>
              <p className="text-xs text-muted-foreground">{t.templates.subtitle}</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || phones.length === 0}>
                  {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  <span className="hidden sm:inline">{syncing ? t.templates.syncing : t.templates.syncWithMeta}</span>
                </Button>
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  {t.templates.newTemplate}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status pills */}
            <div className="-mb-1 flex gap-1.5 overflow-x-auto pb-1">
              {STATUS_TABS.map((status) => {
                const label = status
                  ? {
                      approved: t.templates.statusApproved,
                      pending: t.templates.statusPending,
                      rejected: t.templates.statusRejected,
                      paused: t.templates.statusPaused,
                      draft: t.templates.statusDraft,
                      disabled: t.templates.statusDisabled,
                    }[status]
                  : t.templates.filterAll;
                const isActive = statusFilter === status;
                const count = status ? (countByStatus[status] ?? 0) : templates.length;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive && status
                        ? TEMPLATE_STATUS_COLORS[status]
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {label}
                    <span className={cn("text-[10px] font-normal", isActive ? "opacity-80" : "opacity-60")}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {phones.length > 1 && (
                <SimpleSelect
                  className="h-8 w-44 text-xs"
                  value={selectedPhone}
                  onChange={(value) => {
                    setSelectedPhone(value);
                    setPhoneNumberId(value);
                  }}
                  options={[
                    { value: "", label: t.templates.filterAll },
                    ...phones.map((p) => ({ value: p.id, label: p.label || p.displayPhone })),
                  ]}
                />
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 w-44 pl-8 text-xs md:w-56"
                  placeholder={t.templates.searchPlaceholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          {notice && (
            <InlineNotice variant={notice.variant} className="mt-2">
              {notice.text}
            </InlineNotice>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading && templates.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <LayoutTemplate className="mb-2 size-12 opacity-40" />
              <p className="text-sm">{searchInput || statusFilter ? t.templates.noResults : t.templates.noTemplates}</p>
              {isAdmin && !searchInput && !statusFilter && (
                <p className="mt-1 text-xs">{t.templates.noTemplatesHint}</p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block [&_[data-slot=table-container]]:overflow-x-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.templates.name}</TableHead>
                      <TableHead>{t.templates.language}</TableHead>
                      <TableHead>{t.templates.category}</TableHead>
                      <TableHead>{t.templates.status}</TableHead>
                      <TableHead>{t.templates.quality}</TableHead>
                      <TableHead>{t.templates.updated}</TableHead>
                      {isAdmin && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <span className="font-mono text-xs">{template.name}</span>
                          {template.status === "rejected" && template.rejectionReason && (
                            <p className="mt-0.5 text-[11px] text-destructive">
                              {t.templates.rejectionReason}: {template.rejectionReason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{template.language}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {
                              {
                                marketing: t.templates.categoryMarketing,
                                utility: t.templates.categoryUtility,
                                authentication: t.templates.categoryAuthentication,
                              }[template.category]
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TemplateStatusBadge status={template.status} />
                        </TableCell>
                        <TableCell>
                          <TemplateQualityIndicator quality={template.qualityScore} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <TemplateActions
                              template={template}
                              onEdit={() => setEditing(template)}
                              onDelete={() => handleDelete(template)}
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
                {templates.map((template) => (
                  <div key={template.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-medium">{template.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {template.language} ·{" "}
                          {
                            {
                              marketing: t.templates.categoryMarketing,
                              utility: t.templates.categoryUtility,
                              authentication: t.templates.categoryAuthentication,
                            }[template.category]
                          }
                        </p>
                      </div>
                      {isAdmin && (
                        <TemplateActions
                          template={template}
                          onEdit={() => setEditing(template)}
                          onDelete={() => handleDelete(template)}
                        />
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <TemplateStatusBadge status={template.status} />
                      <TemplateQualityIndicator quality={template.qualityScore} />
                    </div>
                    {template.status === "rejected" && template.rejectionReason && (
                      <p className="mt-1.5 text-[11px] text-destructive">
                        {t.templates.rejectionReason}: {template.rejectionReason}
                      </p>
                    )}
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

      <RightPanel open={panelOpen} onClose={closePanel}>
        {panelOpen && (
          <TemplateEditorPanel
            key={editing?.id ?? "new"}
            template={editing ?? undefined}
            phoneNumbers={phones}
            onSaved={closePanel}
            onCancel={closePanel}
          />
        )}
      </RightPanel>
    </div>
  );
}

function TemplateActions({
  template,
  onEdit,
  onDelete,
}: {
  template: MessageTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslations();
  const canEdit = EDITABLE_STATUSES.includes(template.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && <DropdownMenuItem onSelect={onEdit}>{t.templates.edit}</DropdownMenuItem>}
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          {t.templates.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
