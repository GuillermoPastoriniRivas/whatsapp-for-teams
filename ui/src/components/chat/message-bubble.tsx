"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import type { Message } from "@/types";
import { MessageMedia } from "./message-media";

interface Props {
  message: Message;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusIcon({ status }: { status: Message["waStatus"] }) {
  if (status === "read") {
    return <CheckCheck className="h-4 w-4 text-blue-500" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="h-4 w-4 text-slate-400" />;
  }
  if (status === "sent") {
    return <Check className="h-4 w-4 text-slate-400" />;
  }
  return null;
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === "outbound";
  // Un sticker se dibuja suelto, sin fondo de burbuja, como en WhatsApp.
  const isBareSticker = message.media?.kind === "sticker" && !message.body;

  return (
    <div className={cn("flex w-full mt-2 mb-1", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] text-[15px] leading-relaxed overflow-hidden",
          isBareSticker
            ? "px-0 py-0"
            : cn(
                "px-3 pt-2 pb-1.5 shadow-sm",
                isOutbound
                  ? "bg-[var(--asis-bubble-outbound)] text-slate-900 dark:text-slate-100 rounded-[16px] rounded-tr-[4px]"
                  : "bg-[var(--asis-bubble-inbound)] text-slate-900 dark:text-slate-100 rounded-[16px] rounded-tl-[4px]"
              )
        )}
      >
        {isOutbound && message.senderAgentName && !isBareSticker && (
          <p className="text-[12px] font-semibold text-primary mb-0.5">
            {message.senderAgentName}
          </p>
        )}
        {message.media && <MessageMedia media={message.media} outbound={isOutbound} />}
        {message.body && (
          <p className="whitespace-pre-wrap break-words inline">{message.body}</p>
        )}
        {/* Mensaje interactivo saliente: dibuja sus botones/opciones */}
        {message.interactivePayload && (
          <div className="mt-2 space-y-1 clear-both">
            {(message.interactivePayload.buttons ?? []).map((button) => (
              <div
                key={button.id}
                className="rounded-md bg-white/70 dark:bg-white/10 border border-black/5 py-1 text-center text-[13px] text-sky-600 dark:text-sky-400"
              >
                {button.title}
              </div>
            ))}
            {message.interactivePayload.kind === "list" && (
              <div className="rounded-md bg-white/70 dark:bg-white/10 border border-black/5 py-1 text-center text-[13px] text-sky-600 dark:text-sky-400">
                ≡ {message.interactivePayload.buttonText ?? "Ver opciones"}
                <span className="block text-[11px] text-slate-500">
                  {(message.interactivePayload.rows ?? []).map((row) => row.title).join(" · ")}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Inline spacer + timestamp — sits at the end of the last text line */}
        <span className="inline-flex items-center gap-1 align-bottom float-right ml-2 mt-1 translate-y-[2px]">
          <span className={cn(
            "text-[11px] font-medium leading-none",
            isOutbound ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
          )}>
            {formatTime(message.timestamp)}
          </span>
          {isOutbound && <StatusIcon status={message.waStatus} />}
        </span>
      </div>
    </div>
  );
}
