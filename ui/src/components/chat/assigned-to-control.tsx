"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Bot, Check, ChevronDown, Loader2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

const statusDot: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  offline: "bg-gray-400",
};

interface Props {
  conversationId: string;
  /** Agent the conversation is currently assigned to, if any. */
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  assignedAgentType?: "human" | "ai" | null;
}

export function AssignedToControl({
  conversationId,
  assignedAgentId,
  assignedAgentName,
  assignedAgentType,
}: Props) {
  const currentAgent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentAgent?.role === "admin";
  const isMine = !!assignedAgentId && assignedAgentId === currentAgent?.id;

  // Only admins can hand a conversation to someone else, so only they need the list.
  const loadAgents = async (open: boolean) => {
    setError(null);
    if (!open || !isAdmin || agents.length > 0) return;
    setLoading(true);
    try {
      const data = await api.get<Agent[]>("/agents");
      setAgents(data);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const assignTo = async (agentId: string) => {
    if (agentId === assignedAgentId || assigning) return;
    setAssigning(true);
    setError(null);
    try {
      await api.patch(`/conversations/${conversationId}/assign`, { agentId });
      await useConversationStore.getState().fetch();
    } catch (err: any) {
      setError(err?.message || t.chat.assignError);
    } finally {
      setAssigning(false);
    }
  };

  const label = isMine
    ? t.chat.assignedToMe
    : assignedAgentName || t.chat.assignedToNobody;

  const others = agents.filter((a) => a.id !== currentAgent?.id);

  return (
    <DropdownMenu onOpenChange={loadAgents}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="shrink-0 h-auto max-w-[180px] gap-1.5 rounded-md px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          {assignedAgentType === "ai" ? (
            <Bot className="h-4 w-4 shrink-0 text-violet-500" />
          ) : assignedAgentId ? (
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : null}

          <span className="flex flex-col items-start min-w-0 leading-none">
            <span className="text-[10px] font-normal text-muted-foreground">
              {t.chat.assignedTo}
            </span>
            <span
              className={cn(
                "mt-0.5 max-w-full truncate text-sm font-semibold text-slate-900 dark:text-slate-100",
                !assignedAgentId && "font-normal text-muted-foreground"
              )}
            >
              {label}
            </span>
          </span>

          {assigning ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {t.chat.assignedTo}
        </DropdownMenuLabel>

        {/* Me — always available, this replaces the old "claim" action */}
        <DropdownMenuItem
          className="gap-2"
          disabled={isMine || assigning}
          onSelect={() => currentAgent && assignTo(currentAgent.id)}
        >
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{t.chat.assignedToMe}</span>
          {isMine && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            {loading ? (
              <div className="px-2 py-3 text-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : others.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {t.chat.assignedToNobody}
              </p>
            ) : (
              others.map((a) => {
                const isCurrent = a.id === assignedAgentId;
                return (
                  <DropdownMenuItem
                    key={a.id}
                    className="gap-2"
                    disabled={isCurrent || assigning}
                    onSelect={() => assignTo(a.id)}
                  >
                    {a.type === "ai" ? (
                      <Bot className="h-4 w-4 text-violet-500" />
                    ) : (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0 ml-1 mr-1",
                          statusDot[a.status] ?? statusDot.offline
                        )}
                      />
                    )}
                    <span className="flex-1 truncate">{a.name}</span>
                    {isCurrent && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                );
              })
            )}
          </>
        )}

        {error && (
          <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
