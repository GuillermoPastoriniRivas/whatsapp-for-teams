"use client";

import { useAuthStore } from "@/stores/auth.store";
import { AgentStatusToggle } from "@/components/agent/agent-status-toggle";
import { MessageCircle } from "lucide-react";

export function AppHeader() {
  const agent = useAuthStore((s) => s.agent);

  if (!agent) return null;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]">
          <MessageCircle className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold hidden sm:inline">
          WhatsApp for Teams
        </span>
      </div>
      <AgentStatusToggle />
    </header>
  );
}
