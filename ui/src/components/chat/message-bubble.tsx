"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import type { Message } from "@/types";

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

  return (
    <div className={cn("flex w-full mt-2 mb-1", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] px-3 pt-2 pb-1.5 text-[15px] leading-relaxed shadow-sm",
          isOutbound
            ? "bg-[var(--hivvo-bubble-outbound)] text-slate-900 dark:text-slate-100 rounded-[16px] rounded-tr-[4px]"
            : "bg-[var(--hivvo-bubble-inbound)] text-slate-900 dark:text-slate-100 rounded-[16px] rounded-tl-[4px]"
        )}
      >
        {isOutbound && message.senderAgentName && (
          <p className="text-[12px] font-semibold text-primary mb-0.5">
            {message.senderAgentName}
          </p>
        )}
        {message.body && (
          <p className="whitespace-pre-wrap inline">{message.body}</p>
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
