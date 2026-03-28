"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  offline: "bg-gray-400",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onAssigned: () => void;
}

export function AssignAgentDialog({
  open,
  onOpenChange,
  conversationId,
  onAssigned,
}: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<Agent[]>("/agents")
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleAssign = async (agentId: string) => {
    setAssigning(agentId);
    try {
      await api.patch(`/conversations/${conversationId}/assign`, { agentId });
      onAssigned();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message || "Failed to assign");
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Assign to Agent</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents found</p>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          statusColors[agent.status]
                        )}
                      />
                      <span className="text-xs text-muted-foreground capitalize">
                        {agent.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {agent.activeCount} active
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    agent.status === "offline" || assigning === agent.id
                  }
                  onClick={() => handleAssign(agent.id)}
                >
                  {assigning === agent.id ? "..." : "Assign"}
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
