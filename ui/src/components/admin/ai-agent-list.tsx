"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Bot, Snowflake } from "lucide-react";

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
import { useVerticalLabels } from "./verticals";
import { CreateAiAgentPanel } from "./create-ai-agent-panel";
import { AiAgentDetailPanel } from "./ai-agent-detail-panel";
import type { AiAgentWithConfig } from "@/types";

interface Props {
  onPanelChange: (content: ReactNode) => void;
  onPanelClose: () => void;
  /** Ver `AgentList`: la cabecera de la página dispara el alta desde acá. */
  createRef?: RefObject<(() => void) | null>;
}

export function AiAgentList({ onPanelChange, onPanelClose, createRef }: Props) {
  const [agents, setAgents] = useState<AiAgentWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { usage, fetchUsage, toggleResource } = useBillingStore();
  const { t } = useTranslations();
  const verticalLabels = useVerticalLabels();
  const aiUsage = usage?.aiBots;
  const atLimit = aiUsage ? !aiUsage.allowed : false;

  const handleActivate = async (agentItem: AiAgentWithConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const activeAgents = agents.filter(a => a.config.isActive);
    const deactivateId = atLimit && activeAgents.length > 0 ? activeAgents[activeAgents.length - 1].id : undefined;
    await toggleResource("ai_bots", agentItem.id, deactivateId);
    fetchAgents();
    fetchUsage();
  };

  const fetchAgents = () => {
    setLoading(true);
    api
      .get<AiAgentWithConfig[]>("/ai-agents")
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
      <CreateAiAgentPanel
        onCreated={() => {
          fetchAgents();
          closePanel();
        }}
        onCancel={closePanel}
      />
    );
  };

  const openDetail = (agent: AiAgentWithConfig) => {
    setSelectedId(agent.id);
    onPanelChange(
      <AiAgentDetailPanel
        agent={agent}
        onUpdated={fetchAgents}
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
      {atLimit && aiUsage && (
        <InlineNotice variant="warning">
          {t.billing.limitReached} ({aiUsage.current}/{aiUsage.limit}). {t.billing.upgradeToAdd}
        </InlineNotice>
      )}

      {agents.length === 0 ? (
        <EmptyState icon={Bot} title={t.agents.noAiAgents} description={t.agents.noAiAgentsHint} />
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {agents.map((agent) => {
            const profile = agent.config.businessProfile;
            return (
              // Fila con rol de botón: adentro hay otro botón real ("Activar").
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
                  !agent.config.isActive && "opacity-50"
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    <StatusPill tone="scheduled">{t.agents.aiBadge}</StatusPill>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {verticalLabels[profile?.vertical ?? "generic"] ?? t.agents.verticalGeneric}
                    {profile?.businessName ? ` · ${profile.businessName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!agent.config.isActive ? (
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
            );
          })}
        </div>
      )}
    </div>
  );
}
