"use client";

import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConversationFilters() {
  const { statusFilter, setFilter, view, setView } = useConversationStore();
  const { t } = useTranslations();

  const filters = [
    { value: "", label: t.conversations.filterAll },
    { value: "active", label: t.conversations.filterActive },
    { value: "unassigned", label: t.conversations.filterUnassigned },
    { value: "resolved", label: t.conversations.filterResolved },
  ];

  const views = [
    { value: "inbox" as const, label: t.conversations.viewInbox },
    { value: "campaign" as const, label: t.conversations.viewCampaigns },
  ];

  return (
    <div className="space-y-1.5">
      {/* Inbox / unanswered-campaigns switcher */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setView(v.value)}
            className={cn(
              "truncate rounded-md px-2 py-1 text-xs font-medium transition-colors",
              view === v.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

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
