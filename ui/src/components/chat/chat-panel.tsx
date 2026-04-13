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
import { useTranslations } from "@/lib/i18n/use-translations";
import type { ChatItem, ConversationEvent } from "@/types";

function formatDateLabel(
  dateStr: string,
  locale: "es" | "en",
  labels: { today: string; yesterday: string },
): string {
  const loc = locale === "es" ? "es" : "en";
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - target.getTime();
  const dayMs = 86_400_000;

  if (diff === 0) return labels.today;
  if (diff === dayMs) return labels.yesterday;
  if (diff < 7 * dayMs) {
    return d.toLocaleDateString(loc, { weekday: "long" });
  }
  return d.toLocaleDateString(loc, {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function DateSeparator({
  date,
  locale,
  labels,
}: {
  date: string;
  locale: "es" | "en";
  labels: { today: string; yesterday: string };
}) {
  return (
    <div className="flex justify-center my-3">
      <span className="bg-muted/80 dark:bg-muted/50 rounded-lg px-3 py-1 text-xs text-muted-foreground font-medium shadow-sm">
        {formatDateLabel(date, locale, labels)}
      </span>
    </div>
  );
}

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
  const { t, locale } = useTranslations();
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
    type TimelineItem =
      | { kind: "message"; data: (typeof convMessages)[number] }
      | { kind: "event"; data: ConversationEvent };

    const items: TimelineItem[] = [
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

    // Insert date separators when the day changes
    const withDates: ChatItem[] = [];
    let lastDate = "";
    for (const item of items) {
      const ts =
        item.kind === "message" ? item.data.timestamp : item.data.createdAt;
      const dateKey = new Date(ts).toDateString();
      if (dateKey !== lastDate) {
        withDates.push({ kind: "date", date: ts });
        lastDate = dateKey;
      }
      withDates.push(item);
    }
    return withDates;
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
    <div className="flex h-full overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-1 min-w-0 flex-col relative">
        <ChatHeader
          conversationId={conversationId}
          onToggleContactInfo={() => setContactInfoOpen((prev) => !prev)}
        />
        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden w-full px-4 sm:px-[5%] md:px-[5%] lg:px-[10%]">
          <div className="flex flex-col py-6 min-h-full">
            {chatItems.map((item) =>
              item.kind === "date" ? (
                <DateSeparator key={`date-${item.date}`} date={item.date} locale={locale} labels={t.chat} />
              ) : item.kind === "message" ? (
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
