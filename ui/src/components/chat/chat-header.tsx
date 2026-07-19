"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConversationStore } from "@/stores/conversation.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { ChatMenu } from "./chat-menu";
import { AssignAgentDialog } from "./assign-agent-dialog";
import { avatarStyle, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
  onToggleContactInfo: () => void;
}

export function ChatHeader({ conversationId, onToggleContactInfo }: Props) {
  const router = useRouter();
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === conversationId)
  );
  const updateConversation = useConversationStore((s) => s.updateConversation);

  const currentAgent = useAuthStore((s) => s.agent);

  const { t } = useTranslations();
  const [assignOpen, setAssignOpen] = useState(false);

  const isMine = conversation?.agentId === currentAgent?.id;

  const handleClaim = async () => {
    if (!currentAgent) return;
    await api.patch(`/conversations/${conversationId}/assign`, {
      agentId: currentAgent.id,
    });
    useConversationStore.getState().fetch();
  };

  const handleAssigned = () => {
    useConversationStore.getState().fetch();
  };

  const contact = conversation?.contact;

  return (
    <>
      <div className="flex h-[60px] shrink-0 items-center justify-between bg-[var(--asis-surface-header)] px-4 py-2 border-b border-border shadow-sm z-10 w-full">
        <div className="flex items-center gap-3 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 -ml-2 text-slate-500"
            onClick={() => router.push("/conversations")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Clickable avatar + name area → toggles contact info panel */}
          <button
            onClick={onToggleContactInfo}
            className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
          >
            {contact?.name?.trim() ? (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  avatarStyle(contact.name.trim())
                )}
              >
                {initials(contact.name)}
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500">
                <User className="h-6 w-6 mt-1" />
              </div>
            )}
            <div className="flex flex-col min-w-0 text-left">
              <h2 className="truncate font-medium text-[15px] leading-tight text-slate-900 dark:text-slate-100">
                {contact?.name || "Unknown"}
              </h2>
              <span className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                +{contact?.waId || contact?.phone || "—"}
                {conversation?.phoneLabel && (
                  <span className="ml-1 text-slate-400 dark:text-slate-500">
                    · {conversation.phoneLabel}
                  </span>
                )}
                {conversation?.agentName && (
                  <span className="ml-1.5 text-primary">
                    · {conversation.agentName}
                  </span>
                )}
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {!isMine && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex shrink-0 rounded-full px-4 h-9 shadow-sm"
              onClick={handleClaim}
            >
              {t.chat.claim}
            </Button>
          )}
          <ChatMenu
            onViewContact={onToggleContactInfo}
            onAssign={() => setAssignOpen(true)}
            onClaim={handleClaim}
            isMine={isMine}
          />
        </div>
      </div>

      <AssignAgentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        conversationId={conversationId}
        onAssigned={handleAssigned}
      />
    </>
  );
}
