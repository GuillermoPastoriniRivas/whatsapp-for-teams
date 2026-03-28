"use client";

import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation.store";
import type { Conversation } from "@/types";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  
  // If today, return time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  // Otherwise return date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface Props {
  conversation: Conversation;
  onSelect: () => void;
}

export function ConversationItem({ conversation, onSelect }: Props) {
  const pathname = usePathname();
  const isActive = pathname.includes(conversation.id);
  const unreadCount = useConversationStore((s) => s.unreadCounts[conversation.id] || 0);
  
  const statusColors: Record<string, string> = {
    active: "bg-[#25D366]",
    unassigned: "bg-red-500",
    resolved: "bg-slate-300 dark:bg-slate-700",
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors border-b border-transparent group",
        isActive 
          ? "bg-[#F0F2F5] dark:bg-[#2A3942]" 
          : "hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]"
      )}
    >
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 overflow-hidden">
          <User className="h-7 w-7 mt-1.5" />
        </div>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950",
            statusColors[conversation.status]
          )}
        />
      </div>
      
      <div className="flex-1 min-w-0 border-b border-slate-100 dark:border-slate-800/60 pb-1 group-last:border-transparent h-full flex flex-col justify-center">
        <div className="flex items-center justify-between mb-0.5">
          <span className="truncate font-medium text-[15px] text-slate-900 dark:text-slate-100">
            {conversation.contact?.name || `+${conversation.contact?.waId || "Unknown"}`}
          </span>
          {conversation.phoneLabel && (
            <Badge variant="outline" className="ml-1.5 h-4 text-[9px] px-1.5 shrink-0 font-normal text-muted-foreground">
              {conversation.phoneLabel}
            </Badge>
          )}
          <span className={cn(
            "text-xs whitespace-nowrap ml-2",
            conversation.status === "unassigned" ? "text-red-500 font-medium" : "text-slate-500 dark:text-slate-400"
          )}>
            {timeAgo(conversation.lastMessageAt)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-slate-500 dark:text-slate-400">
            {conversation.status === "resolved"
              ? "Conversation resolved"
              : conversation.agentName
                ? `Agent: ${conversation.agentName}`
                : "Unassigned"}
          </span>
          {conversation.status === "unassigned" && (
            <div className="ml-2 flex h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              NEW
            </div>
          )}
          {unreadCount > 0 && (
            <div className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
