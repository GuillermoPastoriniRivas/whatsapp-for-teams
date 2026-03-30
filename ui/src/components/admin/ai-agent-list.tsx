"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateAiAgentDialog } from "./create-ai-agent-dialog";
import { AiAgentDetail } from "./ai-agent-detail";
import type { AiAgentWithConfig } from "@/types";

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function AiAgentList() {
  const [agents, setAgents] = useState<AiAgentWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AiAgentWithConfig | null>(null);

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
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Agents</h2>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add AI Agent
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No AI agents yet. Create one to automate conversations.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgent(agent)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 sm:p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{agent.name}</p>
                  <Badge variant="outline" className="text-[10px] h-5 bg-violet-50 text-violet-700 border-violet-200">
                    AI
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {providerLabels[agent.config.provider] || agent.config.provider} · {agent.config.model}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      statusColors[agent.status] || "bg-gray-400"
                    )}
                  />
                  <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
                    {agent.status}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {agent.activeCount}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateAiAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchAgents}
      />

      <AiAgentDetail
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
        onUpdated={fetchAgents}
      />
    </div>
  );
}
