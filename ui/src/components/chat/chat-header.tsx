"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConversationStore } from "@/stores/conversation.store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { ContactInfoSheet } from "./contact-info-sheet";
import { ChatMenu } from "./chat-menu";
import { AssignAgentDialog } from "./assign-agent-dialog";

interface Props {
  conversationId: string;
}

export function ChatHeader({ conversationId }: Props) {
  const router = useRouter();
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === conversationId)
  );
  const updateConversation = useConversationStore((s) => s.updateConversation);

  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const handleResolve = async () => {
    await api.patch(`/conversations/${conversationId}/resolve`);
    updateConversation({ id: conversationId, status: "resolved" });
    router.push("/conversations");
  };

  const handleAssigned = () => {
    useConversationStore.getState().fetch();
  };

  const contact = conversation?.contact;
  const isResolved = conversation?.status === "resolved";

  return (
    <>
      <div className="flex h-[60px] items-center justify-between bg-[#F0F2F5] dark:bg-[#202C33] px-4 py-2 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 w-full">
        <div className="flex items-center gap-3 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 -ml-2 text-slate-500"
            onClick={() => router.push("/conversations")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Clickable avatar + name area → opens contact info */}
          <button
            onClick={() => setContactInfoOpen(true)}
            className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500">
              <User className="h-6 w-6 mt-1" />
            </div>
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
                  <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                    · {conversation.agentName}
                  </span>
                )}
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {!isResolved && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex shrink-0 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-full px-4 h-9 shadow-sm"
              onClick={handleResolve}
            >
              Resolve
            </Button>
          )}
          <ChatMenu
            onViewContact={() => setContactInfoOpen(true)}
            onAssign={() => setAssignOpen(true)}
            onResolve={handleResolve}
            isResolved={isResolved}
          />
        </div>
      </div>

      <ContactInfoSheet
        open={contactInfoOpen}
        onOpenChange={setContactInfoOpen}
        conversation={conversation}
      />

      <AssignAgentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        conversationId={conversationId}
        onAssigned={handleAssigned}
      />
    </>
  );
}
