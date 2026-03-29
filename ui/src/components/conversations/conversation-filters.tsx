"use client";

import { useConversationStore } from "@/stores/conversation.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const filters = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "unassigned", label: "Unassigned" },
  { value: "resolved", label: "Resolved" },
];

export function ConversationFilters() {
  const { statusFilter, setFilter } = useConversationStore();

  return (
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
  );
}
