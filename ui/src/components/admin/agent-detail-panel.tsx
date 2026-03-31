"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { User, Save, Trash2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

interface Props {
  agent: Agent;
  onUpdated: (updated?: Agent) => void;
  onDeleted: () => void;
}

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function AgentDetailPanel({ agent, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(agent.name);
    setRole(agent.role);
    setError(null);
    setSuccess(null);
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.patch<Agent>(`/agents/${agent.id}`, { name, role });
      setSuccess("Saved successfully");
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      await api.delete(`/agents/${agent.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  const isAi = agent.type === "ai";

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            isAi ? "bg-violet-100 dark:bg-violet-900/30" : "bg-slate-100 dark:bg-slate-800"
          )}>
            {isAi
              ? <Bot className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              : <User className="h-6 w-6 text-muted-foreground" />
            }
          </div>
          <div>
            <h2 className="text-base font-semibold">{agent.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", statusColors[agent.status])} />
                <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
              </div>
              <Badge variant="outline" className="capitalize text-[10px] h-5">{agent.role}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input value={agent.email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Role</label>
          <div className="flex gap-2">
            {(["agent", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                  role === r
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", statusColors[agent.status])} />
            <span className="text-sm capitalize">{agent.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Active conversations: {agent.activeCount}
          </p>
        </div>

        {(error || success) && (
          <div className={`rounded-md px-3 py-2 text-sm ${
            error ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          }`}>
            {error || success}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1 bg-primary hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
