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
import { StatusDot, type StatusTone } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";

export function AgentStatusToggle({ collapsed }: { collapsed?: boolean }) {
  const agent = useAuthStore((s) => s.agent);
  const [currentStatus, setCurrentStatus] = useState<string>("available");
  const { t } = useTranslations();

  const statuses: { value: string; label: string; tone: StatusTone }[] = [
    { value: "available", label: t.common.statusAvailable, tone: "success" },
    { value: "busy", label: t.common.statusBusy, tone: "warning" },
    { value: "offline", label: t.common.statusOffline, tone: "neutral" },
  ];

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
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("gap-2", !collapsed && "justify-start")}
          aria-label={collapsed ? current.label : undefined}
        >
          <StatusDot tone={current.tone} className="size-2.5" />
          {!collapsed && <span className="truncate text-sm">{current.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "start" : "end"}>
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => handleChange(s.value)}
            className="gap-2"
          >
            <StatusDot tone={s.tone} className="size-2.5" />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
