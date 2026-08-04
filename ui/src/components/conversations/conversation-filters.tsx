"use client";

import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { FilterPill } from "@/components/ui/filter-pill";

export function ConversationFilters() {
  const { statusFilter, setFilter } = useConversationStore();
  const { t } = useTranslations();

  const filters = [
    { value: "", label: t.conversations.filterAll },
    { value: "unread", label: t.conversations.filterUnread },
    { value: "active", label: t.conversations.filterActive },
    { value: "unassigned", label: t.conversations.filterUnassigned },
  ];

  return (
    <div className="space-y-1.5">
      <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
        {filters.map((f) => (
          <FilterPill
            key={f.value}
            active={statusFilter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}
