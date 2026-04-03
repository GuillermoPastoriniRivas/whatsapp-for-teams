import {
  UserPlus,
  RefreshCw,
  CheckCircle,
  RotateCcw,
  PlusCircle,
  UserMinus,
  StickyNote,
  ArrowRightLeft,
  Tag,
  Tags,
} from "lucide-react";

export const eventConfig: Record<
  string,
  {
    icon: typeof UserPlus;
    color: string;
    label: (data: Record<string, unknown>) => string;
  }
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
  handoff: {
    icon: ArrowRightLeft,
    color: "text-indigo-500",
    label: (data) =>
      `${data.aiAgentName ?? "AI"} handed off to a human agent`,
  },
  label_added: {
    icon: Tag,
    color: "text-teal-500",
    label: (data) => `${data.agentName} added label "${data.labelName}"`,
  },
  label_removed: {
    icon: Tags,
    color: "text-slate-400",
    label: (data) => `${data.agentName} removed label "${data.labelName}"`,
  },
};

export function formatEventTime(dateStr: string): string {
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
