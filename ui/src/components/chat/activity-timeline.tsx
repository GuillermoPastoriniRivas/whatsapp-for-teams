"use client";

import { cn } from "@/lib/utils";
import { eventConfig, formatEventTime } from "@/lib/event-labels";
import type { ConversationEvent } from "@/types";

interface Props {
  events: ConversationEvent[];
}

export function ActivityTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No activity yet
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => {
        const config = eventConfig[event.type] ?? eventConfig.created;
        const Icon = config.icon;
        const isLast = i === events.length - 1;

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted",
                  config.color
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border my-1" />
              )}
            </div>
            <div className={cn("pb-4 pt-1", isLast && "pb-0")}>
              <p className="text-sm leading-tight">
                {config.label(event.data)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatEventTime(event.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
