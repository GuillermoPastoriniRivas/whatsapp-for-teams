"use client";

import { useRouter } from "next/navigation";
import { useConversationStore } from "@/stores/conversation.store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, User } from "lucide-react";
import { ChatMenu } from "./chat-menu";
import { AssignedToControl } from "./assigned-to-control";
import { FlowChip } from "./flow-chip";
import { avatarStyle, initials } from "@/lib/avatar";
import { displayIdentity, identitySubtitle } from "@/lib/identity";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
  onToggleContactInfo: () => void;
}

export function ChatHeader({ conversationId, onToggleContactInfo }: Props) {
  const router = useRouter();
  const { t } = useTranslations();
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === conversationId)
  );
  const contact = conversation?.contact;

  return (
    <>
      <div className="flex h-[60px] shrink-0 items-center justify-between bg-[var(--asis-surface-header)] px-4 py-2 border-b border-border shadow-sm z-(--z-sticky) w-full">
        <div className="flex items-center gap-3 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 -ml-2 text-muted-foreground"
            onClick={() => router.push("/conversations")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Clickable avatar + name area → toggles contact info panel */}
          <button
            onClick={onToggleContactInfo}
            className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
          >
            <Avatar size="lg">
              <AvatarFallback
                className={cn(
                  "font-semibold",
                  contact?.name?.trim() && avatarStyle(contact.name.trim())
                )}
              >
                {contact?.name?.trim() ? initials(contact.name) : <User className="size-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 text-left">
              <h2 className="truncate font-medium text-base leading-tight text-foreground">
                {displayIdentity(contact, t.chat.unknown)}
              </h2>
              <span className="truncate text-xs text-muted-foreground mt-0.5">
                {identitySubtitle(contact)}
                {conversation?.phoneLabel && <span className="ml-1">· {conversation.phoneLabel}</span>}
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <FlowChip conversationId={conversationId} />
          <AssignedToControl
            conversationId={conversationId}
            assignedAgentId={conversation?.agentId}
            assignedAgentName={conversation?.agentName}
            assignedAgentType={conversation?.agentType}
          />
          <ChatMenu onViewContact={onToggleContactInfo} />
        </div>
      </div>
    </>
  );
}
