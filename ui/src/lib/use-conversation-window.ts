"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conversation, Message } from "@/types";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Espeja la regla del backend (send-message.use-case): WhatsApp solo permite
 * mensajes libres dentro de las 24hs del último mensaje entrante del cliente.
 * Devuelve true si la ventana está abierta. Se recalcula solo cuando llega un
 * mensaje nuevo y también cuando la ventana vence con el chat abierto.
 */
export function useConversationWindow(
  conversation: Conversation | undefined,
  messages: Message[],
): boolean {
  const lastInboundTs = useMemo(() => {
    let ts = conversation?.lastInboundAt
      ? new Date(conversation.lastInboundAt).getTime()
      : 0;
    for (const m of messages) {
      if (m.direction === "inbound") {
        const t = new Date(m.timestamp).getTime();
        if (t > ts) ts = t;
      }
    }
    return ts;
  }, [conversation?.lastInboundAt, messages]);

  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!lastInboundTs) return;
    const remaining = lastInboundTs + WINDOW_MS - Date.now();
    if (remaining <= 0) return;
    // Re-render justo cuando vence la ventana (cap: setTimeout no soporta más de ~24.8 días)
    const id = setTimeout(
      () => forceTick((n) => n + 1),
      Math.min(remaining + 1000, 0x7fffffff),
    );
    return () => clearTimeout(id);
  }, [lastInboundTs]);

  // Sin datos todavía (conversación no cargada): no bloquear; el backend valida igual
  if (!lastInboundTs) return true;
  return Date.now() - lastInboundTs < WINDOW_MS;
}
