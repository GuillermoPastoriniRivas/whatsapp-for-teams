"use client";

import { useAuthStore } from "@/stores/auth.store";
import { AgentStatusToggle } from "@/components/agent/agent-status-toggle";
import { AsisLogo } from "@/components/brand/asis-logo";

export function AppHeader() {
  const agent = useAuthStore((s) => s.agent);

  if (!agent) return null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background px-4 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 min-w-0">
        <AsisLogo size={32} className="text-primary shrink-0" />
        <span className="font-semibold truncate">
          asis<span className="text-primary">.chat</span>
          <span className="hidden sm:inline text-muted-foreground font-normal"> · {agent.name}</span>
        </span>
      </div>
      <AgentStatusToggle />
    </header>
  );
}
