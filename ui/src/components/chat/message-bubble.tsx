"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck, MoreVertical } from "lucide-react";
import type { Message } from "@/types";
import { MessageMedia } from "./message-media";
import { MessageLocation } from "./message-location";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessageStore } from "@/stores/message.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { toast } from "@/lib/toast";

/** Las de WhatsApp, en su orden. No es una paleta: es un teclado. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface Props {
  message: Message;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// El doble tilde azul del "leído" es lenguaje de WhatsApp, igual que las
// burbujas: el usuario lo lee como color, no como token.
function StatusIcon({ status }: { status: Message["waStatus"] }) {
  if (status === "read") {
    return <CheckCheck className="h-4 w-4 text-blue-500" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
  }
  if (status === "sent") {
    return <Check className="h-4 w-4 text-muted-foreground" />;
  }
  return null;
}

export function MessageBubble({ message }: Props) {
  const { t } = useTranslations();
  const setReplyTo = useMessageStore((s) => s.setReplyTo);
  const react = useMessageStore((s) => s.react);
  const isOutbound = message.direction === "outbound";
  // Un sticker se dibuja suelto, sin fondo de burbuja, como en WhatsApp.
  const isBareSticker = message.media?.kind === "sticker" && !message.body;

  // Una reacción no es un mensaje más del hilo: es un emoji colgado de otro
  // mensaje. Sin burbuja ni hora, para que no compita con la conversación.
  if (message.messageType === "reaction") {
    return (
      <div
        className={cn(
          "flex w-full -mt-1 mb-1",
          isOutbound ? "justify-end pr-2" : "justify-start pl-2"
        )}
      >
        <span
          title={isOutbound ? "Reaccionaste a un mensaje" : "Reaccionó a un mensaje"}
          className="rounded-full bg-muted px-2 py-0.5 text-sm leading-none ring-1 ring-foreground/10"
        >
          {message.body}
        </span>
      </div>
    );
  }

  const sendReaction = async (emoji: string) => {
    try {
      await react(message.conversationId, message.id, emoji);
      toast.success(t.chat.reactionSent);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t.chat.sendError);
    }
  };

  return (
    <div
      className={cn(
        "group flex w-full mt-2 mb-1 items-center gap-1",
        isOutbound ? "justify-end" : "justify-start"
      )}
    >
      {/* Las acciones van del lado del centro del hilo para no empujar la
          burbuja contra el borde. En mobile quedan siempre visibles: no hay
          hover al que engancharlas. */}
      {isOutbound && <MessageActions />}

      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] text-base leading-relaxed overflow-hidden",
          isBareSticker
            ? "px-0 py-0"
            : cn(
                "px-3 pt-2 pb-1.5 shadow-sm text-foreground",
                isOutbound
                  ? "bg-[var(--asis-bubble-outbound)] rounded-[16px] rounded-tr-[4px]"
                  : "bg-[var(--asis-bubble-inbound)] rounded-[16px] rounded-tl-[4px]"
              )
        )}
      >
        {isOutbound && message.senderAgentName && !isBareSticker && (
          <p className="text-xs font-semibold text-primary mb-0.5">
            {message.senderAgentName}
          </p>
        )}
        {message.media && <MessageMedia media={message.media} outbound={isOutbound} />}
        {message.location && (
          <MessageLocation location={message.location} outbound={isOutbound} />
        )}
        {/* En una ubicación el body es el nombre del lugar, que ya sale en la
            tarjeta del mapa: repetirlo debajo se lee como un mensaje extra. */}
        {message.body && !message.location && (
          <p className="whitespace-pre-wrap break-words inline">{message.body}</p>
        )}
        {/* Mensaje interactivo saliente: dibuja sus botones/opciones */}
        {message.interactivePayload && (
          <div className="mt-2 space-y-1 clear-both">
            {(message.interactivePayload.buttons ?? []).map((button) => (
              <div
                key={button.id}
                className="rounded-md bg-white/70 dark:bg-white/10 border border-black/5 py-1 text-center text-sm text-sky-600 dark:text-sky-400"
              >
                {button.title}
              </div>
            ))}
            {message.interactivePayload.kind === "list" && (
              <div className="rounded-md bg-white/70 dark:bg-white/10 border border-black/5 py-1 text-center text-sm text-sky-600 dark:text-sky-400">
                ≡ {message.interactivePayload.buttonText ?? "Ver opciones"}
                <span className="block text-xs text-muted-foreground">
                  {(message.interactivePayload.rows ?? []).map((row) => row.title).join(" · ")}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Inline spacer + timestamp — sits at the end of the last text line */}
        <span className="inline-flex items-center gap-1 align-bottom float-right ml-2 mt-1 translate-y-[2px]">
          <span className="text-xs font-medium leading-none text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
          {isOutbound && <StatusIcon status={message.waStatus} />}
        </span>
      </div>

      {!isOutbound && <MessageActions />}
    </div>
  );

  function MessageActions() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.chat.messageActions}
            className="shrink-0 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOutbound ? "end" : "start"} className="w-44">
          {/* WhatsApp sólo deja reaccionar a lo que mandó el cliente: sobre un
              mensaje nuestro los emojis no van. */}
          {!isOutbound && (
            <div className="flex justify-between px-1 pb-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`${t.chat.react} ${emoji}`}
                  className="size-8 rounded-md text-base transition-colors hover:bg-muted"
                  onClick={() => sendReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <DropdownMenuItem onSelect={() => setReplyTo(message)}>{t.chat.reply}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
