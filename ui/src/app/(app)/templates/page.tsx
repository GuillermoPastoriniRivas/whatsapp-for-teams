"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutTemplate,  MoreHorizontal, Plus, RefreshCw, Search, Send} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, Spinner } from "@/components/ui/spinner";
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
import { InlineNotice } from "@/components/shared/inline-notice";
import { TemplateEditorPanel } from "./_components/template-editor-panel";
import { SendTemplateDialog } from "./_components/send-template-dialog";
import {
  TemplateQualityIndicator,
  TemplateStatusBadge,
  useTemplateStatusLabels,
} from "./_components/template-status-badge";
import { useTemplateStore } from "@/stores/template.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
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
  const confirm = useConfirm();
  const statusLabels = useTemplateStatusLabels();
  const isAdmin = agent?.role === "admin";

  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  // Sin plantilla, el diálogo la deja elegir; con una, viene desde la fila.
  const [sendTemplate, setSendTemplate] = useState<MessageTemplate | undefined>(undefined);

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
    if (!(await confirm({ title: t.templates.confirmDelete, confirmLabel: t.common.delete, destructive: true }))) return;
    try {
      await remove(template.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.genericError);
    }
  };

  const closePanel = () => {
    setEditing(null);
    setCreating(false);
  };

  const panelOpen = creating || !!editing;

  return (
    <div className="flex h-full">
      <PageShell className="min-w-0 flex-1">
        <PageHeader
          title={t.templates.title}
          subtitle={t.templates.subtitle}
          actions={
            <>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || phones.length === 0}>
                  {syncing ? <Spinner size="sm" /> : <RefreshCw className="size-4" />}
                  <span className="hidden sm:inline">{syncing ? t.templates.syncing : t.templates.syncWithMeta}</span>
                </Button>
              )}
              <Button
                variant={isAdmin ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  setSendTemplate(undefined);
                  setSendOpen(true);
                }}
                disabled={phones.length === 0}
              >
                <Send className="size-4" />
                {t.templates.newSend}
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  {t.templates.newTemplate}
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
              count={status ? (countByStatus[status] ?? 0) : templates.length}
            >
              {status ? statusLabels[status] : t.templates.filterAll}
            </FilterPill>
          ))}
        </PageHeader>

        <PageContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {phones.length > 1 && (
              <SimpleSelect
                className="w-36 shrink-0 sm:w-44"
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
            <div className="relative min-w-0 flex-1 sm:max-w-56">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t.templates.searchPlaceholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          {notice && <InlineNotice variant={notice.variant}>{notice.text}</InlineNotice>}

          {isLoading && templates.length === 0 ? (
            <LoadingState />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={LayoutTemplate}
              title={searchInput || statusFilter ? t.templates.noResults : t.templates.noTemplates}
              description={isAdmin && !searchInput && !statusFilter ? t.templates.noTemplatesHint : undefined}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.templates.name}</TableHead>
                      <TableHead>{t.templates.language}</TableHead>
                      <TableHead>{t.templates.category}</TableHead>
                      <TableHead>{t.templates.status}</TableHead>
                      <TableHead>{t.templates.quality}</TableHead>
                      <TableHead>{t.templates.updated}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <span className="font-mono text-xs">{template.name}</span>
                          {template.status === "rejected" && template.rejectionReason && (
                            <p className="mt-0.5 text-xs text-destructive">
                              {t.templates.rejectionReason}: {template.rejectionReason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{template.language}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
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
                        <TableCell>
                          <TemplateActions
                            template={template}
                            isAdmin={isAdmin}
                            onSend={() => {
                              setSendTemplate(template);
                              setSendOpen(true);
                            }}
                            onEdit={() => setEditing(template)}
                            onDelete={() => handleDelete(template)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-medium">{template.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
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
                      <TemplateActions
                        template={template}
                        isAdmin={isAdmin}
                        onSend={() => {
                          setSendTemplate(template);
                          setSendOpen(true);
                        }}
                        onEdit={() => setEditing(template)}
                        onDelete={() => handleDelete(template)}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <TemplateStatusBadge status={template.status} />
                      <TemplateQualityIndicator quality={template.qualityScore} />
                    </div>
                    {template.status === "rejected" && template.rejectionReason && (
                      <p className="mt-1.5 text-xs text-destructive">
                        {t.templates.rejectionReason}: {template.rejectionReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Pagination page={meta.page} pages={meta.pages} onPageChange={(page) => fetch(page)} />
            </>
          )}
        </PageContent>
      </PageShell>

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

      <SendTemplateDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        phones={phones}
        template={sendTemplate}
      />
    </div>
  );
}

function TemplateActions({
  template,
  isAdmin,
  onSend,
  onEdit,
  onDelete,
}: {
  template: MessageTemplate;
  isAdmin: boolean;
  onSend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslations();
  const canEdit = isAdmin && EDITABLE_STATUSES.includes(template.status);
  // Enviar no es privilegio de admin: cualquier agente escribe a un cliente.
  // Solo tiene sentido con la plantilla ya aprobada por Meta.
  const canSend = template.status === "approved";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canSend && <DropdownMenuItem onSelect={onSend}>{t.templates.sendToNumber}</DropdownMenuItem>}
        {canEdit && <DropdownMenuItem onSelect={onEdit}>{t.templates.edit}</DropdownMenuItem>}
        {isAdmin && (
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            {t.templates.delete}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
