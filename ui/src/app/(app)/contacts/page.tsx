"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, User, Phone, Building2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { Pagination } from "@/components/ui/pagination";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContactFields } from "@/components/chat/contact-fields";
import { RightPanel } from "@/components/layout/right-panel";
import { CsvImportPanel } from "@/components/contacts/csv-import-panel";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Contact, PaginatedResponse } from "@/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [selected, setSelected] = useState<Contact | null>(null);
  const [importing, setImporting] = useState(false);
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();

  const fetchContacts = useCallback(async (s: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (s) params.set("search", s);
      const res = await api.get<PaginatedResponse<Contact>>(
        `/contacts?${params}`
      );
      setContacts(res.data);
      setMeta(res.meta);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchContacts(search, 1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, fetchContacts]);

  useEffect(() => {
    if (page > 1) fetchContacts(search, page);
  }, [page]);

  const handleContactUpdated = (
    contactId: string,
    fields: Partial<Contact>
  ) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, ...fields } : c))
    );
    if (selected?.id === contactId) {
      setSelected((prev) => (prev ? { ...prev, ...fields } : prev));
    }
  };

  return (
    <div className="flex h-full">
      {/* Contact list column */}
      <PageShell className="min-w-0 flex-1">
        <PageHeader
          title={t.contacts.title}
          actions={
            agent?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected(null);
                  setImporting(true);
                }}
              >
                <Upload className="size-4" />
                {t.contacts.import}
              </Button>
            )
          }
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t.contacts.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </PageHeader>

        {/* Contact list — full-bleed rows, so the shell padding is dropped */}
        <PageContent className="p-0 pb-20 md:p-0 md:pb-0">
          {loading && contacts.length === 0 ? (
            <LoadingState />
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={User}
              title={search ? t.contacts.noResults : t.contacts.noContacts}
            />
          ) : (
            <>
              <ul className="divide-y">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setImporting(false);
                        setSelected(
                          selected?.id === contact.id ? null : contact
                        );
                      }}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 md:px-6",
                        selected?.id === contact.id && "bg-primary/5"
                      )}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="size-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {contact.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          +{contact.waId || contact.phone}
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        {contact.company && (
                          <Badge variant="secondary" className="gap-1">
                            <Building2 className="size-3" />
                            {contact.company}
                          </Badge>
                        )}
                        {contact.email && (
                          <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <Pagination
                page={meta.page}
                pages={meta.pages}
                onPageChange={setPage}
                className="border-t pb-4"
              />
            </>
          )}
        </PageContent>
      </PageShell>

      {/* Contact detail / import side panel */}
      <RightPanel
        open={!!selected || importing}
        onClose={() => {
          setSelected(null);
          setImporting(false);
        }}
      >
        {importing && (
          <CsvImportPanel onImported={() => fetchContacts(search, 1)} />
        )}
        {selected && (
          <>
            <div className="flex flex-col items-center bg-[var(--asis-surface-header)] pb-6 pt-8">
              <div className="mb-3 flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="size-10" />
              </div>
              <h2 className="px-4 text-center text-base font-semibold">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                +{selected.waId || selected.phone}
              </p>
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.contacts.contactInfo}
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <span>+{selected.waId || selected.phone}</span>
                </div>
                <ContactFields
                  contact={{
                    id: selected.id,
                    email: selected.email ?? null,
                    company: selected.company ?? null,
                    notes: selected.notes ?? null,
                    customFields: selected.customFields ?? {},
                  }}
                  onUpdated={(fields) =>
                    handleContactUpdated(selected.id, fields)
                  }
                />
              </div>

              {selected.notes && (
                <>
                  <div className="border-t" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.contacts.notes}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm">
                      {selected.notes}
                    </p>
                  </div>
                </>
              )}

              {selected.lastSeenAt && (
                <p className="pt-2 text-xs text-muted-foreground">
                  {t.contacts.lastSeen}:{" "}
                  {new Date(selected.lastSeenAt).toLocaleString()}
                </p>
              )}
            </div>
          </>
        )}
      </RightPanel>
    </div>
  );
}
