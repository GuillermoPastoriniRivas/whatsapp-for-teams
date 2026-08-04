"use client";

// Chip "⚡ Flujo activo" del header del chat + aviso del composer.
// El estado viene del detalle de la conversación y se refresca con los
// eventos FLOW_* del socket.

import { useCallback, useEffect, useState } from "react";
import { Workflow, StopCircle } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { ActiveFlowInfo } from "@/types";

export function useActiveFlow(conversationId: string): { activeFlow: ActiveFlowInfo | null; refresh: () => void } {
  const [activeFlow, setActiveFlow] = useState<ActiveFlowInfo | null>(null);

  const refresh = useCallback(() => {
    api
      .get<{ activeFlow: ActiveFlowInfo | null }>(`/conversations/${conversationId}`)
      .then((detail) => setActiveFlow(detail.activeFlow ?? null))
      .catch(() => setActiveFlow(null));
  }, [conversationId]);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return;
    const onEvent = (event: { conversationId?: string; type?: string }) => {
      if (event?.conversationId === conversationId && event?.type?.startsWith("flow_")) refresh();
    };
    socket.on("conversation.event", onEvent);
    return () => {
      socket.off("conversation.event", onEvent);
    };
  }, [conversationId, refresh]);

  return { activeFlow, refresh };
}

export function FlowChip({ conversationId }: { conversationId: string }) {
  const { t } = useTranslations();
  const confirm = useConfirm();
  const { activeFlow, refresh } = useActiveFlow(conversationId);

  if (!activeFlow) return null;

  const stop = async () => {
    if (!(await confirm({ title: t.flows.stopFlowConfirm, confirmLabel: t.flows.stopFlow, destructive: true }))) return;
    try {
      await api.post(`/flow-executions/${activeFlow.executionId}/cancel`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.flows.stopFlowError);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 max-w-56">
      <Workflow className="size-3.5 shrink-0" />
      <span className="truncate">{activeFlow.flowName}</span>
      <button
        className="text-primary hover:text-destructive shrink-0"
        aria-label={t.flows.stopFlow}
        title={t.flows.stopFlow}
        onClick={() => void stop()}
      >
        <StopCircle className="size-3.5" />
      </button>
    </span>
  );
}

export function FlowComposerNote({ conversationId }: { conversationId: string }) {
  const { t } = useTranslations();
  const { activeFlow } = useActiveFlow(conversationId);
  if (!activeFlow) return null;
  return (
    <div className="text-xs text-accent bg-accent/10 px-4 py-1 text-center">
      {t.flows.composerFlowNote}
    </div>
  );
}
