"use client";

import { useAuthStore } from "@/stores/auth.store";
import { AgentStatusToggle } from "@/components/agent/agent-status-toggle";
import { FluwsLogo } from "@/components/brand/fluws-logo";

export function AppHeader() {
  const agent = useAuthStore((s) => s.agent);

  if (!agent) return null;

  return (
    <header className="sticky top-0 z-(--z-panel) flex items-center justify-between border-b bg-background px-4 h-[calc(var(--mobile-nav-h)+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 min-w-0">
        <FluwsLogo size={32} className="shrink-0" />
        <span className="font-semibold truncate">
          fluws
          <span className="hidden sm:inline text-muted-foreground font-normal"> · {agent.name}</span>
        </span>
      </div>
      <AgentStatusToggle />
    </header>
  );
}
