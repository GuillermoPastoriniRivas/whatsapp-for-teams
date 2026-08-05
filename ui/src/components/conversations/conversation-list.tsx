"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useConversationStore } from "@/stores/conversation.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ConversationItem } from "./conversation-item";
import { ConversationFilters } from "./conversation-filters";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { getSocket } from "@/lib/socket";
import { MessageSquare, Search } from "lucide-react";

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

    // conversation.updated llega a todo el tenant con cada mensaje entrante:
    // el refetch trae lastMessageAt y unreadCount actualizados del servidor
    socket.on("conversation.new", refetch);
    socket.on("conversation.assigned", refetch);
    socket.on("conversation.updated", refetch);
    socket.on("conversation.unassigned", refetch);

    return () => {
      socket.off("conversation.new", refetch);
      socket.off("conversation.assigned", refetch);
      socket.off("conversation.updated", refetch);
      socket.off("conversation.unassigned", refetch);
    };
  }, []);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      // Se busca sobre los tres ejes: el teléfono ya no siempre está, y el
      // username es lo único que un agente puede tipear de esos contactos.
      const haystack = [
        conv.contact?.name,
        conv.contact?.phone,
        conv.contact?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
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
      {/* Scroll nativo: el ScrollArea de Radix envuelve en display:table y se
          estira al contenido más ancho, empujando hora/badge fuera de vista */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {isLoading && conversations.length === 0 ? (
          <LoadingState label={t.common.loading} />
        ) : filteredConversations.length === 0 ? (
          !searchQuery && agent?.requiresOnboarding !== true ? (
            <OnboardingChecklist />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title={searchQuery ? t.conversations.noResults : t.conversations.noConversations}
              className="py-12"
            />
          )
        ) : (
          <div>
            {filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onSelect={() => handleSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
