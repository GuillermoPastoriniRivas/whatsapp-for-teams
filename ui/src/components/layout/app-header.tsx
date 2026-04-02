"use client";

import { useAuthStore } from "@/stores/auth.store";
import { AgentStatusToggle } from "@/components/agent/agent-status-toggle";
import { AsisLogo } from "@/components/brand/asis-logo";

export function AppHeader() {
  const agent = useAuthStore((s) => s.agent);

  if (!agent) return null;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <AsisLogo size={32} className="text-primary" />
        <span className="font-semibold hidden sm:inline">
          asis<span className="text-primary">.chat</span> - {agent.name}
        </span>
      </div>
      <AgentStatusToggle />
    </header>
  );
}
