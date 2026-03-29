"use client";

import { useAuthStore } from "@/stores/auth.store";
import { AgentStatusToggle } from "@/components/agent/agent-status-toggle";
import { Hexagon } from "lucide-react";

export function AppHeader() {
  const agent = useAuthStore((s) => s.agent);

  if (!agent) return null;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#0D9488] to-[#0F766E]">
          <Hexagon className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold hidden sm:inline">
          Hivvo.chat - {agent.name}
        </span>
      </div>
      <AgentStatusToggle />
    </header>
  );
}
