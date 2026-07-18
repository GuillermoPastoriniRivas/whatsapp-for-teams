"use client";

import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LabelBadge } from "@/components/chat/label-badge";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { Conversation } from "@/types";

function timeAgo(dateStr: string, yesterdayLabel: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return yesterdayLabel;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// La API de WhatsApp no expone la foto de perfil de los clientes: avatar de
// iniciales con color determinístico por nombre, estilo apps de mensajería
const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-orange-500",
  "bg-sky-600",
  "bg-violet-600",
  "bg-rose-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-indigo-500",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface Props {
  conversation: Conversation;
  onSelect: () => void;
}

export function ConversationItem({ conversation, onSelect }: Props) {
  const pathname = usePathname();
  const isActive = pathname.includes(conversation.id);
  const unreadCount = useConversationStore((s) => s.unreadCounts[conversation.id] || 0);
  const { t } = useTranslations();

  const contactName = conversation.contact?.name?.trim() || "";

  const statusColors: Record<string, string> = {
    active: "bg-primary",
    unassigned: "bg-accent",
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors border-b border-transparent group",
        isActive
          ? "bg-muted"
          : "hover:bg-muted/50"
      )}
    >
      <div className="relative shrink-0">
        {conversation.contact?.profilePicUrl ? (
          <img
            src={conversation.contact.profilePicUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : contactName ? (
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-semibold text-white",
              avatarColor(contactName)
            )}
          >
            {initials(contactName)}
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 overflow-hidden">
            <User className="h-7 w-7 mt-1.5" />
          </div>
        )}
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950",
            statusColors[conversation.status]
          )}
        />
      </div>
      
      <div className="flex-1 min-w-0 border-b border-slate-100 dark:border-slate-800/60 pb-1 group-last:border-transparent h-full flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={cn(
              "truncate text-[15px] text-slate-900 dark:text-slate-100",
              unreadCount > 0 ? "font-semibold" : "font-medium"
            )}
          >
            {contactName || `+${conversation.contact?.waId || t.chat.unknown}`}
          </span>
          {conversation.phoneLabel && (
            <Badge variant="outline" className="h-4 max-w-[90px] min-w-0 shrink px-1.5 text-[9px] font-normal text-muted-foreground">
              <span className="truncate">{conversation.phoneLabel}</span>
            </Badge>
          )}
          <span className={cn(
            "text-xs whitespace-nowrap ml-auto shrink-0",
            conversation.status === "unassigned" ? "text-accent font-medium" : "text-slate-500 dark:text-slate-400"
          )}>
            {timeAgo(conversation.lastMessageAt, t.chat.yesterday)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-slate-500 dark:text-slate-400">
            {conversation.agentName
              ? `${t.conversations.agentPrefix}: ${conversation.agentName}`
              : t.chat.unassigned}
          </span>
          {conversation.status === "unassigned" && (
            <div className="ml-2 flex h-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
              {t.conversations.newBadge}
            </div>
          )}
          {unreadCount > 0 && (
            <div className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}
        </div>
        {conversation.labels && conversation.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {conversation.labels.slice(0, 3).map((l) => (
              <LabelBadge key={l.id} name={l.name} color={l.color} size="sm" />
            ))}
            {conversation.labels.length > 3 && (
              <span className="text-[9px] text-muted-foreground leading-4">
                +{conversation.labels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
