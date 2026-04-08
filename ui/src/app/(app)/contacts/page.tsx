"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, User, Phone, Mail, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ContactFields } from "@/components/chat/contact-fields";
import { RightPanel } from "@/components/layout/right-panel";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import type { Contact, PaginatedResponse } from "@/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [selected, setSelected] = useState<Contact | null>(null);
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
    <div className="h-full flex">
      {/* Contact list column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b px-4 py-3 md:px-6">
          <h1 className="text-xl font-bold mb-3">{t.contacts.title}</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.contacts.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {loading && contacts.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">
                {search ? t.contacts.noResults : t.contacts.noContacts}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(
                          selected?.id === contact.id ? null : contact
                        )
                      }
                      className={`w-full flex items-center gap-3 px-4 py-3 md:px-6 hover:bg-muted/50 transition-colors text-left ${
                        selected?.id === contact.id
                          ? "bg-primary/5"
                          : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <User className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contact.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          +{contact.waId || contact.phone}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        {contact.company && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Building2 className="h-3 w-3" />
                            {contact.company}
                          </Badge>
                        )}
                        {contact.email && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {meta.pages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4 border-t">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm rounded-md border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    {t.contacts.previous}
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {meta.page} / {meta.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(meta.pages, p + 1))
                    }
                    disabled={page >= meta.pages}
                    className="px-3 py-1.5 text-sm rounded-md border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    {t.contacts.next}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contact detail side panel */}
      <RightPanel open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="bg-[var(--asis-surface-header)] pt-8 pb-6 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 mb-3">
                <User className="h-10 w-10" />
              </div>
              <h2 className="text-lg font-semibold text-center px-4">
                {selected.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                +{selected.waId || selected.phone}
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  {t.contacts.contactInfo}
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
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
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                      {t.contacts.notes}
                    </h3>
                    <p className="text-sm whitespace-pre-wrap">
                      {selected.notes}
                    </p>
                  </div>
                </>
              )}

              {selected.lastSeenAt && (
                <p className="text-xs text-muted-foreground pt-2">
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
