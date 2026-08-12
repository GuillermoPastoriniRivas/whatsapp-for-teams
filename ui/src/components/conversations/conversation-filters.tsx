"use client";

import { Megaphone, X } from "lucide-react";

import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { FilterPill } from "@/components/ui/filter-pill";
import { Badge } from "@/components/ui/badge";

export function ConversationFilters() {
  const { statusFilter, adSourceId, setFilter, setAdFilter } = useConversationStore();
  const { t } = useTranslations();

  const filters = [
    { value: "", label: t.conversations.filterAll },
    { value: "unread", label: t.conversations.filterUnread },
    { value: "active", label: t.conversations.filterActive },
    { value: "unassigned", label: t.conversations.filterUnassigned },
    { value: "ads", label: t.conversations.filterFromAds },
  ];

  return (
    <div className="space-y-1.5">
      <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
        {filters.map((f) => (
          <FilterPill
            key={f.value}
            active={!adSourceId && statusFilter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </FilterPill>
        ))}
      </div>

      {adSourceId && (
        <Badge variant="secondary" className="gap-1.5 font-normal">
          <Megaphone className="size-3" />
          <span className="max-w-40 truncate font-mono text-xs">{adSourceId}</span>
          <button
            type="button"
            onClick={() => setAdFilter(null)}
            aria-label={t.conversations.filterAll}
            className="-mr-0.5 rounded-full p-0.5 hover:bg-foreground/10"
          >
            <X className="size-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
