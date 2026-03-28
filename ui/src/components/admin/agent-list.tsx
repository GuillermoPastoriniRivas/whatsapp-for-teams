"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateAgentDialog } from "./create-agent-dialog";
import type { Agent } from "@/types";

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

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
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agents</h2>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[#25D366] hover:bg-[#1da851]"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 rounded-lg border p-3 sm:p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{agent.name}</p>
                  <Badge variant="outline" className="capitalize text-[10px] h-5">
                    {agent.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {agent.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      statusColors[agent.status]
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
            </div>
          ))}
        </div>
      )}

      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchAgents}
      />
    </div>
  );
}
