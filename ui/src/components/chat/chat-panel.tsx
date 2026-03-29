"use client";

import { useEffect, useRef } from "react";
import { useMessageStore } from "@/stores/message.store";
import { useConversationStore } from "@/stores/conversation.store";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSocket } from "@/lib/socket";

interface Props {
  conversationId: string;
}

export function ChatPanel({ conversationId }: Props) {
  const messages = useMessageStore((s) => s.messages);
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === conversationId)
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const convMessages = messages[conversationId] || [];

  useEffect(() => {
    useConversationStore.getState().clearUnread(conversationId);
  }, [conversationId]);

  useEffect(() => {
    useMessageStore.getState().fetch(conversationId);

    const socket = getSocket();
    if (!socket) return;

    socket.emit("join:conversation", { conversationId });

    const handleNewMessage = (msg: any) => {
      useMessageStore.getState().appendMessage(conversationId, msg);
    };
    const handleStatusUpdate = (data: any) => {
      useMessageStore.getState().updateStatus(data.waMessageId, data.waStatus);
    };

    socket.on("message.new", handleNewMessage);
    socket.on("message.status", handleStatusUpdate);

    return () => {
      socket.emit("leave:conversation", { conversationId });
      socket.off("message.new", handleNewMessage);
      socket.off("message.status", handleStatusUpdate);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convMessages.length]);

  return (
    <div className="flex h-full flex-col relative">
      <ChatHeader conversationId={conversationId} />
      <ScrollArea className="flex-1 w-full px-4 sm:px-[5%] md:px-[10%] lg:px-[15%]">
        <div className="flex flex-col py-6 min-h-full">
          {convMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </ScrollArea>
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
