"use client";

import { useEffect, useState } from "react";
import {  Plus, Search, User} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useTranslations } from "@/lib/i18n/use-translations";
import { displayIdentity, identitySubtitle } from "@/lib/identity";
import { api } from "@/lib/api";
import type { Contact, PaginatedResponse } from "@/types";

/** Accepts a paste of several numbers separated by commas, semicolons or newlines. */
const MANUAL_SEPARATORS = /[\s,;]+/;

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
  const [manualInput, setManualInput] = useState("");
  const [manualAdding, setManualAdding] = useState(false);
  const [manualRejected, setManualRejected] = useState<string[]>([]);

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

  /**
   * Turns typed numbers into contacts (created on the fly if they aren't saved
   * yet) and adds them to the same selection as the picked ones.
   */
  const addManual = async () => {
    const numbers = manualInput.split(MANUAL_SEPARATORS).filter(Boolean);
    if (numbers.length === 0) return;

    setManualAdding(true);
    const next = new Map(selected);
    const rejected: string[] = [];
    for (const phone of numbers) {
      try {
        const contact = await api.post<Contact>("/contacts", { phone });
        next.set(contact.id, contact);
      } catch {
        rejected.push(phone);
      }
    }
    onChange(next);
    setManualRejected(rejected);
    setManualInput(rejected.join(", "));
    setManualAdding(false);
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
          <Button type="button" variant="ghost" size="sm" onClick={selectPage}>
            {t.campaigns.selectPage}
          </Button>
          {selected.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onChange(new Map())}
            >
              {t.campaigns.clearSelection}
            </Button>
          )}
        </div>
      </div>

      {/* Manual entry — numbers that aren't in the contact list yet */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder={t.campaigns.manualPhonePlaceholder}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (!manualAdding) void addManual();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={manualAdding || manualInput.trim().length === 0}
            onClick={addManual}
          >
            {manualAdding ? <Spinner size="sm" /> : <Plus className="size-3.5" />}
            {t.campaigns.manualPhoneAdd}
          </Button>
        </div>
        <p className="text-xs leading-tight text-muted-foreground">{t.campaigns.manualPhoneHint}</p>
        {manualRejected.length > 0 && (
          <InlineNotice variant="error">
            {t.campaigns.manualPhoneInvalid}: {manualRejected.join(", ")}
          </InlineNotice>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t.contacts.searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">
        {loading && contacts.length === 0 ? (
          <LoadingState className="py-6" />
        ) : contacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.contacts.noResults}</p>
        ) : (
          contacts.map((contact) => (
            <label key={contact.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted/50">
              <Checkbox checked={selected.has(contact.id)} onCheckedChange={() => toggle(contact)} />
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayIdentity(contact)}</p>
                <p className="truncate text-xs text-muted-foreground">{identitySubtitle(contact)}</p>
              </div>
            </label>
          ))
        )}
      </div>

      <Pagination page={meta.page} pages={meta.pages} onPageChange={setPage} className="pt-0" />
    </div>
  );
}
