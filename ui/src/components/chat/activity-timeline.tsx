"use client";

import {
  UserPlus,
  RefreshCw,
  CheckCircle,
  RotateCcw,
  PlusCircle,
  UserMinus,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationEvent } from "@/types";

const eventConfig: Record<
  string,
  { icon: typeof UserPlus; color: string; label: (data: Record<string, unknown>) => string }
> = {
  created: {
    icon: PlusCircle,
    color: "text-blue-500",
    label: () => "Conversation started",
  },
  assigned: {
    icon: UserPlus,
    color: "text-green-500",
    label: (data) =>
      data.auto
        ? `Auto-assigned to ${data.agentName}`
        : `Assigned to ${data.agentName}`,
  },
  reassigned: {
    icon: RefreshCw,
    color: "text-orange-500",
    label: (data) =>
      `Reassigned from ${data.fromAgentName} to ${data.toAgentName}`,
  },
  unassigned: {
    icon: UserMinus,
    color: "text-red-500",
    label: () => "Unassigned — no available agents",
  },
  resolved: {
    icon: CheckCircle,
    color: "text-emerald-500",
    label: (data) => `Resolved by ${data.agentName}`,
  },
  reopened: {
    icon: RotateCcw,
    color: "text-purple-500",
    label: () => "Reopened by new inbound message",
  },
  note_added: {
    icon: StickyNote,
    color: "text-yellow-500",
    label: (data) => `${data.agentName} added a note`,
  },
};

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
