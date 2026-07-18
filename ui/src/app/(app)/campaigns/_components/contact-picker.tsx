"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import type { Contact, PaginatedResponse } from "@/types";

interface ContactPickerProps {
  selected: Map<string, Contact>;
  onChange: (selected: Map<string, Contact>) => void;
}

/**
 * Paginated contact multi-select with debounced search.
 * The selection Map persists across searches and pages.
 */
export function ContactPicker({ selected, onChange }: ContactPickerProps) {
  const { t } = useTranslations();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        const res = await api.get<PaginatedResponse<Contact>>(`/contacts?${params}`);
        setContacts(res.data);
        setMeta(res.meta);
      } catch {
        setContacts([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, page]);

  const toggle = (contact: Contact) => {
    const next = new Map(selected);
    if (next.has(contact.id)) next.delete(contact.id);
    else next.set(contact.id, contact);
    onChange(next);
  };

  const selectPage = () => {
    const next = new Map(selected);
    for (const contact of contacts) next.set(contact.id, contact);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {/* Sticky selection counter */}
      <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5">
        <span className="text-xs font-medium">
          {selected.size} {t.campaigns.selectedCount}
        </span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={selectPage}>
            {t.campaigns.selectPage}
          </Button>
          {selected.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              onClick={() => onChange(new Map())}
            >
              {t.campaigns.clearSelection}
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-base sm:text-xs"
          placeholder={t.contacts.searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
        {loading && contacts.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{t.contacts.noResults}</p>
        ) : (
          contacts.map((contact) => (
            <label key={contact.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted/50">
              <Checkbox checked={selected.has(contact.id)} onCheckedChange={() => toggle(contact)} />
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <User className="size-3.5 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{contact.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">+{contact.waId || contact.phone}</p>
              </div>
            </label>
          ))
        )}
      </div>

      {meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t.contacts.previous}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {meta.page} / {meta.pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page >= meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t.contacts.next}
          </Button>
        </div>
      )}
    </div>
  );
}
