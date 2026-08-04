"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Bot, Snowflake, User } from "lucide-react";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { InlineNotice } from "@/components/shared/inline-notice";
import { cn } from "@/lib/utils";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { AgentStatus } from "./agent-status";
import { CreateAgentPanel } from "./create-agent-panel";
import { AgentDetailPanel } from "./agent-detail-panel";
import type { Agent } from "@/types";

interface Props {
  onPanelChange: (content: ReactNode) => void;
  onPanelClose: () => void;
  /**
   * La cabecera de la página es la única que muestra acciones, pero el alta
   * vive acá porque tiene que refrescar la lista: se publica en este ref y la
   * página lo dispara desde su botón.
   */
  createRef?: RefObject<(() => void) | null>;
}

export function AgentList({ onPanelChange, onPanelClose, createRef }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { usage, fetchUsage, toggleResource } = useBillingStore();
  const { t } = useTranslations();
  const agentUsage = usage?.humanAgents;
  const atLimit = agentUsage ? !agentUsage.allowed : false;

  const handleActivate = async (agentItem: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    const activeAgents = agents.filter(a => a.type !== "ai" && !a.frozen);
    const deactivateId = atLimit && activeAgents.length > 0 ? activeAgents[activeAgents.length - 1].id : undefined;
    await toggleResource("human_agents", agentItem.id, deactivateId);
    fetchAgents();
    fetchUsage();
  };

  const fetchAgents = () => {
    setLoading(true);
    api
      .get<Agent[]>("/agents")
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
    fetchUsage();
  }, []);

  const closePanel = () => {
    setSelectedId(null);
    onPanelClose();
  };

  const openCreate = () => {
    setSelectedId("__create__");
    onPanelChange(
      <CreateAgentPanel
        onCreated={() => {
          fetchAgents();
          closePanel();
        }}
        onCancel={closePanel}
      />
    );
  };

  const openDetail = (agent: Agent) => {
    setSelectedId(agent.id);
    onPanelChange(
      <AgentDetailPanel
        agent={agent}
        onUpdated={(updated) => {
          fetchAgents();
          if (updated) openDetail(updated);
        }}
        onDeleted={() => {
          fetchAgents();
          closePanel();
        }}
      />
    );
  };

  useEffect(() => {
    if (createRef) createRef.current = openCreate;
  });

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3">
      {atLimit && agentUsage && (
        <InlineNotice variant="warning">
          {t.billing.limitReached} ({agentUsage.current}/{agentUsage.limit}). {t.billing.upgradeToAdd}
        </InlineNotice>
      )}

      {agents.length === 0 ? (
        <EmptyState icon={User} title={t.agents.noAgents} description={t.agents.noAgentsHint} />
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {agents.map((agent) => (
            // Fila con rol de botón (no `<button>`): adentro hay otro botón
            // real —"Activar"— y anidar botones no es HTML válido.
            <div
              key={agent.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail(agent)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetail(agent);
                }
              }}
              className={cn(
                "flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                selectedId === agent.id && "bg-primary/5",
                agent.frozen && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  agent.type === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {agent.type === "ai" ? <Bot className="size-5" /> : <User className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  {agent.type === "ai" ? (
                    <StatusPill tone="scheduled">{t.agents.aiBadge}</StatusPill>
                  ) : (
                    <Badge variant="outline">
                      {agent.role === "admin" ? t.agents.roleAdmin : t.agents.roleAgent}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {agent.frozen ? (
                  <>
                    <StatusPill tone="warning">
                      <Snowflake className="size-3" />
                      {t.billing.frozen}
                    </StatusPill>
                    <Button size="sm" variant="ghost" onClick={(e) => handleActivate(agent, e)}>
                      {t.billing.activate}
                    </Button>
                  </>
                ) : (
                  <>
                    <AgentStatus status={agent.status} labelClassName="hidden sm:inline" />
                    <Badge variant="secondary">{agent.activeCount}</Badge>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
