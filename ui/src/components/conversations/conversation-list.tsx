"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useConversationStore } from "@/stores/conversation.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ConversationItem } from "./conversation-item";
import { ConversationFilters } from "./conversation-filters";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { getSocket } from "@/lib/socket";
import { Search } from "lucide-react";

export function ConversationList() {
  const conversations = useConversationStore((s) => s.conversations);
  const isLoading = useConversationStore((s) => s.isLoading);
  const setActive = useConversationStore((s) => s.setActive);
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslations();

  useEffect(() => {
    useConversationStore.getState().fetch();

    // Listen for real-time conversation events
    const socket = getSocket();
    if (!socket) return;

    const refetch = () => {
      useConversationStore.getState().fetch();
    };

    const handleNewMessage = (msg: { conversationId?: string }) => {
      const activeId = useConversationStore.getState().activeId;
      if (msg.conversationId && msg.conversationId !== activeId) {
        useConversationStore.getState().incrementUnread(msg.conversationId);
      }
    };

    socket.on("conversation.new", refetch);
    socket.on("conversation.assigned", refetch);
    socket.on("conversation.resolved", refetch);
    socket.on("conversation.updated", refetch);
    socket.on("conversation.unassigned", refetch);
    socket.on("message.new", handleNewMessage);

    return () => {
      socket.off("conversation.new", refetch);
      socket.off("conversation.assigned", refetch);
      socket.off("conversation.resolved", refetch);
      socket.off("conversation.updated", refetch);
      socket.off("conversation.unassigned", refetch);
      socket.off("message.new", handleNewMessage);
    };
  }, []);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const name = conv.contact?.name?.toLowerCase() || "";
      const waId = conv.contact?.waId?.toLowerCase() || "";
      return name.includes(q) || waId.includes(q);
    });
  }, [conversations, searchQuery]);

  const handleSelect = (id: string) => {
    setActive(id);
    useConversationStore.getState().clearUnread(id);
    router.push(`/conversations/${id}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.conversations.searchPlaceholder}
            className="pl-8"
          />
        </div>
        <ConversationFilters />
      </div>
      <ScrollArea className="flex-1">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {t.common.loading}
          </div>
        ) : filteredConversations.length === 0 ? (
          !searchQuery && agent?.requiresOnboarding !== true ? (
            <OnboardingChecklist />
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {searchQuery ? t.conversations.noResults : t.conversations.noConversations}
            </div>
          )
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onSelect={() => handleSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
