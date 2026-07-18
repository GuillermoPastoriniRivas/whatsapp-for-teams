"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";

interface ToastData {
  key: string;
  conversationId: string;
  title: string;
  body: string;
}

/**
 * Toast in-app para mensajes entrantes con la app enfocada. Escucha el evento
 * tenant-wide message.preview (message.new solo llega a quien tiene abierta
 * esa conversación). Con la app en segundo plano, el aviso es el web push.
 */
export function MessageToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const router = useRouter();
  const { t } = useTranslations();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPreview = (data: {
      conversationId?: string;
      contactName?: string;
      body?: string;
      messageId?: string;
    }) => {
      if (!data?.conversationId) return;
      // Si ya está mirando esa conversación, la UI del chat alcanza
      if (data.conversationId === useConversationStore.getState().activeId) return;
      setToast({
        key: data.messageId ?? `${data.conversationId}-${data.body}`,
        conversationId: data.conversationId,
        title: data.contactName || t.chat.newMessage,
        body: data.body || "",
      });
    };

    socket.on("message.preview", onPreview);
    return () => {
      socket.off("message.preview", onPreview);
    };
  }, [t.chat.newMessage]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      key={toast.key}
      className="fixed z-[70] left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] md:left-auto md:right-4 md:w-96 animate-in slide-in-from-top-2 fade-in duration-200"
    >
      <div className="flex items-start gap-3 rounded-xl border bg-card text-card-foreground p-3 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setToast(null);
            router.push(`/conversations/${toast.conversationId}`);
          }}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{toast.title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {toast.body}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label={t.pwa.installDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
