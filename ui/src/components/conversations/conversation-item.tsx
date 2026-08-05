"use client";

import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LabelBadge } from "@/components/chat/label-badge";
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

import { avatarStyle, initials } from "@/lib/avatar";
import { displayIdentity } from "@/lib/identity";

interface Props {
  conversation: Conversation;
  onSelect: () => void;
}

export function ConversationItem({ conversation, onSelect }: Props) {
  const pathname = usePathname();
  const isActive = pathname.includes(conversation.id);
  // Directo del dato del servidor; la conversación abierta nunca muestra badge
  const unreadCount = isActive ? 0 : (conversation.unreadCount ?? 0);
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
        "flex w-full items-center gap-4 px-4 text-left transition-colors group",
        isActive
          ? "bg-muted"
          : "hover:bg-muted/50"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-12">
          {conversation.contact?.profilePicUrl && (
            <AvatarImage src={conversation.contact.profilePicUrl} alt="" />
          )}
          <AvatarFallback
            className={cn("text-base font-semibold", contactName && avatarStyle(contactName))}
          >
            {contactName ? initials(contactName) : <User className="size-6" />}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            statusColors[conversation.status]
          )}
        />
      </div>

      <div className="flex-1 min-w-0 py-3 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={cn(
              "truncate text-base text-foreground",
              unreadCount > 0 ? "font-semibold" : "font-medium"
            )}
          >
            {displayIdentity(conversation.contact, t.chat.unknown)}
          </span>
          {conversation.phoneLabel && (
            <Badge variant="outline" className="max-w-[90px] min-w-0 shrink px-1.5 font-normal text-muted-foreground">
              <span className="truncate">{conversation.phoneLabel}</span>
            </Badge>
          )}
          <span className={cn(
            "text-xs whitespace-nowrap ml-auto shrink-0",
            conversation.status === "unassigned" ? "text-accent font-medium" : "text-muted-foreground"
          )}>
            {timeAgo(conversation.lastMessageAt, t.chat.yesterday)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-muted-foreground">
            {conversation.agentName
              ? `${t.conversations.agentPrefix}: ${conversation.agentName}`
              : t.chat.unassigned}
          </span>
          {conversation.status === "unassigned" && (
            <div className="ml-2 flex h-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">
              {t.conversations.newBadge}
            </div>
          )}
          {unreadCount > 0 && (
            <div className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
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
              <span className="text-xs text-muted-foreground leading-4">
                +{conversation.labels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
