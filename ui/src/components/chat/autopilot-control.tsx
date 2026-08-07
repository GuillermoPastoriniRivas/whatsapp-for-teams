"use client";

// Piloto automático del chat: si las automatizaciones pueden actuar acá o no.
//
// Es un eje distinto del de "asignado a". Antes la única forma de frenar al bot
// era asignarse la conversación, y eso cancelaba la automatización sin vuelta
// atrás; ahora apagar es reversible y la ejecución conserva su punto.

import { useCallback, useEffect, useState } from "react";
import { Bot, BotOff, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { ConversationAutopilot } from "@/types";

/** Estado del piloto, sincronizado con los eventos del socket. */
export function useAutopilot(conversationId: string) {
  const [autopilot, setAutopilot] = useState<ConversationAutopilot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api
      .get<{ autopilot?: ConversationAutopilot }>(`/conversations/${conversationId}`)
      .then((detail) => setAutopilot(detail.autopilot ?? null))
      .catch(() => setAutopilot(null));
  }, [conversationId]);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return;
    const onEvent = (event: { conversationId?: string; type?: string }) => {
      if (event?.conversationId === conversationId && event?.type?.startsWith("autopilot_")) refresh();
    };
    socket.on("conversation.event", onEvent);
    return () => {
      socket.off("conversation.event", onEvent);
    };
  }, [conversationId, refresh]);

  const set = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      // Optimista: el toggle responde al toque y se revierte si la API falla.
      setAutopilot((prev) => (prev ? { ...prev, enabled } : prev));
      try {
        const next = await api.patch<ConversationAutopilot>(
          `/conversations/${conversationId}/autopilot`,
          { enabled },
        );
        setAutopilot(next);
      } catch (error) {
        refresh();
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar el piloto");
      } finally {
        setBusy(false);
      }
    },
    [conversationId, refresh],
  );

  return { autopilot, busy, set, refresh };
}

export function AutopilotControl({ conversationId }: { conversationId: string }) {
  const { t } = useTranslations();
  const { autopilot, busy, set } = useAutopilot(conversationId);
  if (!autopilot) return null;

  const on = autopilot.enabled;
  const Icon = on ? Bot : BotOff;

  return (
    <Button
      variant="ghost"
      className={cn(
        "shrink-0 h-auto gap-1.5 rounded-md px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10",
        on ? "text-primary" : "text-muted-foreground",
      )}
      disabled={busy}
      onClick={() => void set(!on)}
      title={on ? t.chat.autopilotOnHint : t.chat.autopilotOffHint}
      aria-pressed={on}
    >
      {busy ? <Spinner size="sm" className="shrink-0" /> : <Icon className="size-4 shrink-0" />}
      <span className="flex flex-col items-start min-w-0 leading-none">
        <span className="text-xs font-normal text-muted-foreground">{t.chat.autopilot}</span>
        <span className="mt-0.5 text-sm font-semibold">{on ? t.chat.autopilotOn : t.chat.autopilotOff}</span>
      </span>
    </Button>
  );
}

/**
 * Aviso sobre el composer cuando el piloto quedó apagado. Lo importante no es
 * decir que está apagado — eso ya lo dice el header — sino que se puede volver.
 */
export function AutopilotComposerNote({ conversationId }: { conversationId: string }) {
  const { t } = useTranslations();
  const { autopilot, busy, set } = useAutopilot(conversationId);
  if (!autopilot || autopilot.enabled) return null;

  const because =
    autopilot.pausedReason === "agent_reply" ? t.chat.autopilotPausedByReply : t.chat.autopilotPausedManually;

  return (
    <div className="flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-xs text-muted-foreground">
      <span>{because}</span>
      <button
        className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={() => void set(true)}
      >
        <Play className="size-3" />
        {t.chat.autopilotResume}
      </button>
    </div>
  );
}
