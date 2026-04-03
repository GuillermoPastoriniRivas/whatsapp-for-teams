"use client";

import { eventConfig, formatEventTime } from "@/lib/event-labels";
import type { ConversationEvent } from "@/types";

interface Props {
  event: ConversationEvent;
}

export function EventBubble({ event }: Props) {
  const config = eventConfig[event.type] ?? eventConfig.created;
  const Icon = config.icon;

  return (
    <div className="flex justify-center my-2">
      <span className="inline-flex items-center gap-1.5 bg-muted/60 dark:bg-muted/40 rounded-full px-3 py-1 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
        <span>{config.label(event.data)}</span>
        <span className="opacity-60">·</span>
        <span className="opacity-60">{formatEventTime(event.createdAt)}</span>
      </span>
    </div>
  );
}
