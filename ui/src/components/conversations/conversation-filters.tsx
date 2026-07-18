"use client";

import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConversationFilters() {
  const { statusFilter, setFilter } = useConversationStore();
  const { t } = useTranslations();

  const filters = [
    { value: "", label: t.conversations.filterAll },
    { value: "active", label: t.conversations.filterActive },
    { value: "unassigned", label: t.conversations.filterUnassigned },
    { value: "resolved", label: t.conversations.filterResolved },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5 overflow-x-auto">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 text-xs shrink-0",
              statusFilter === f.value && "bg-primary hover:bg-primary/90"
            )}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
