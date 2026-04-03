"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMessageStore } from "@/stores/message.store";
import { useEventStore } from "@/stores/event.store";
import { useConversationStore } from "@/stores/conversation.store";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { EventBubble } from "./event-bubble";
import { MessageInput } from "./message-input";
import { ContactInfoPanel } from "./contact-info-panel";
import { RightPanel } from "@/components/layout/right-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSocket } from "@/lib/socket";
import { useIsDesktop } from "@/lib/use-is-desktop";
import type { ChatItem, ConversationEvent } from "@/types";

const INLINE_EVENT_TYPES = new Set([
  "assigned",
  "reassigned",
  "unassigned",
  "resolved",
  "reopened",
  "handoff",
  "label_added",
  "label_removed",
]);

interface Props {
  conversationId: string;
}

export function ChatPanel({ conversationId }: Props) {
  const messages = useMessageStore((s) => s.messages);
  const events = useEventStore((s) => s.events);
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === conversationId)
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const convMessages = messages[conversationId] || [];
  const convEvents = events[conversationId] || [];

  const isDesktop = useIsDesktop();
  const [contactInfoOpen, setContactInfoOpen] = useState(false);

  // Open panel by default on desktop
  useEffect(() => {
    // if (isDesktop) setContactInfoOpen(true);
  }, [isDesktop]);

  const chatItems: ChatItem[] = useMemo(() => {
    const items: ChatItem[] = [
      ...convMessages.map((m) => ({ kind: "message" as const, data: m })),
      ...convEvents
        .filter((e) => INLINE_EVENT_TYPES.has(e.type))
        .map((e) => ({ kind: "event" as const, data: e })),
    ];
    items.sort((a, b) => {
      const tA = a.kind === "message" ? a.data.timestamp : a.data.createdAt;
      const tB = b.kind === "message" ? b.data.timestamp : b.data.createdAt;
      return new Date(tA).getTime() - new Date(tB).getTime();
    });
    return items;
  }, [convMessages, convEvents]);

  useEffect(() => {
    useConversationStore.getState().clearUnread(conversationId);
  }, [conversationId]);

  useEffect(() => {
    useMessageStore.getState().fetch(conversationId);
    useEventStore.getState().fetch(conversationId);

    const socket = getSocket();
    if (!socket) return;

    socket.emit("join:conversation", { conversationId });

    const handleNewMessage = (msg: any) => {
      useMessageStore.getState().appendMessage(conversationId, msg);
    };
    const handleStatusUpdate = (data: any) => {
      useMessageStore.getState().updateStatus(data.waMessageId, data.waStatus);
    };
    const handleNewEvent = (event: ConversationEvent) => {
      useEventStore.getState().appendEvent(conversationId, event);
    };

    socket.on("message.new", handleNewMessage);
    socket.on("message.status", handleStatusUpdate);
    socket.on("conversation.event", handleNewEvent);

    return () => {
      socket.emit("leave:conversation", { conversationId });
      socket.off("message.new", handleNewMessage);
      socket.off("message.status", handleStatusUpdate);
      socket.off("conversation.event", handleNewEvent);
    };
  }, [conversationId]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-slot=scroll-area-viewport]"
    ) as HTMLElement | null;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
  }, [chatItems.length]);

  return (
    <div className="flex h-full">
      {/* Chat column */}
      <div className="flex flex-1 min-w-0 flex-col relative">
        <ChatHeader
          conversationId={conversationId}
          onToggleContactInfo={() => setContactInfoOpen((prev) => !prev)}
        />
        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden w-full px-4 sm:px-[5%] md:px-[10%] lg:px-[15%]">
          <div className="flex flex-col py-6 min-h-full">
            {chatItems.map((item) =>
              item.kind === "message" ? (
                <MessageBubble key={item.data.id} message={item.data} />
              ) : (
                <EventBubble key={item.data.id} event={item.data} />
              )
            )}
          </div>
        </ScrollArea>
        <MessageInput conversationId={conversationId} />
      </div>

      {/* Contact info side panel */}
      <RightPanel
        open={contactInfoOpen}
        onClose={() => setContactInfoOpen(false)}
        onOpen={() => setContactInfoOpen(true)}
      >
        <ContactInfoPanel conversation={conversation} />
      </RightPanel>
    </div>
  );
}
