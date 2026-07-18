"use client";

import { useRef, useState } from "react";
import { useMessageStore } from "@/stores/message.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SendHorizontal, Smile, Paperclip } from "lucide-react";

interface Props {
  conversationId: string;
}

export function MessageInput({ conversationId }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = useMessageStore((s) => s.send);
  const { t } = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      await send(conversationId, body);
      setText("");
    } catch (err: any) {
      alert(err.message || t.chat.sendError);
    } finally {
      setSending(false);
      // Mantener el teclado abierto para seguir escribiendo
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2 bg-[var(--asis-surface-header)] px-4 py-3 sm:px-6 w-full shadow-sm z-10 transition-colors duration-200 border-t border-border">
      <Button variant="ghost" size="icon" className="shrink-0 text-slate-500 hover:text-slate-700 hover:bg-black/5 dark:hover:bg-white/5 rounded-full h-10 w-10">
        <Smile className="h-[22px] w-[22px]" />
      </Button>
      <Button variant="ghost" size="icon" className="shrink-0 text-slate-500 hover:text-slate-700 hover:bg-black/5 dark:hover:bg-white/5 rounded-full h-10 w-10 mr-1 hidden sm:flex">
        <Paperclip className="h-[22px] w-[22px]" />
      </Button>
      
      <div className="flex-1 bg-white dark:bg-secondary flex items-center rounded-[24px] px-4 py-1 border border-transparent focus-within:border-primary/30 shadow-sm transition-all">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.chat.typePlaceholder}
          className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none bg-transparent h-[38px] text-base md:text-[15px]"
        />
      </div>
      
      <Button
        size="icon"
        className="shrink-0 bg-primary hover:bg-primary/90 text-white rounded-full h-10 w-10 ml-1 shadow-sm transition-transform active:scale-95"
        onClick={handleSend}
        // Que tocar el botón no le robe el focus al input (cerraría el teclado)
        onMouseDown={(e) => e.preventDefault()}
        disabled={sending || !text.trim()}
      >
        <SendHorizontal className="h-[18px] w-[18px]" />
      </Button>
    </div>
  );
}
