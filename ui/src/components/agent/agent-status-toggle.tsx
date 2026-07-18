"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";

export function AgentStatusToggle() {
  const agent = useAuthStore((s) => s.agent);
  const [currentStatus, setCurrentStatus] = useState<string>("available");
  const { t } = useTranslations();

  const statuses = [
    { value: "available", label: t.common.statusAvailable, color: "bg-green-500" },
    { value: "busy", label: t.common.statusBusy, color: "bg-yellow-500" },
    { value: "offline", label: t.common.statusOffline, color: "bg-gray-400" },
  ] as const;

  if (!agent) return null;

  const current = statuses.find((s) => s.value === currentStatus) ?? statuses[0];

  const handleChange = async (status: string) => {
    const previous = currentStatus;
    setCurrentStatus(status);
    try {
      await api.patch(`/agents/${agent.id}/status`, { status });
    } catch {
      // Revert on failure
      setCurrentStatus(previous);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", current.color)} />
          <span className="text-sm">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => handleChange(s.value)}
            className="gap-2"
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", s.color)} />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
