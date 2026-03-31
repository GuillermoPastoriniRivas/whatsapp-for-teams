"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentList } from "@/components/admin/agent-list";
import { PhoneNumberList } from "@/components/admin/phone-number-list";
import { PhoneAccessManager } from "@/components/admin/phone-access-manager";
import { AiAgentList } from "@/components/admin/ai-agent-list";
import { RightPanel } from "@/components/layout/right-panel";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export default function AdminPage() {
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();
  const [panelContent, setPanelContent] = useState<ReactNode>(null);

  useEffect(() => {
    if (agent && agent.role !== "admin") {
      router.push("/");
    }
  }, [agent, router]);

  if (agent?.role !== "admin") return null;

  const closePanel = () => setPanelContent(null);

  return (
    <div className="h-full flex">
      {/* Left: header + tabs + content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <h1 className="text-xl font-bold mb-4">Admin Panel</h1>
        </div>
        <Tabs
          defaultValue="agents"
          className="flex-1 flex flex-col min-h-0"
          onValueChange={() => closePanel()}
        >
          <div className="px-4 md:px-6">
            <TabsList>
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="ai-agents">AI Agents</TabsTrigger>
              <TabsTrigger value="phones">Phone Numbers</TabsTrigger>
              <TabsTrigger value="access">Phone Access</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="agents" className="mt-0 flex-1 min-h-0">
            <AgentList onPanelChange={setPanelContent} onPanelClose={closePanel} />
          </TabsContent>
          <TabsContent value="ai-agents" className="mt-0 flex-1 min-h-0">
            <AiAgentList onPanelChange={setPanelContent} onPanelClose={closePanel} />
          </TabsContent>
          <TabsContent value="phones" className="mt-0 flex-1 min-h-0">
            <PhoneNumberList onPanelChange={setPanelContent} onPanelClose={closePanel} />
          </TabsContent>
          <TabsContent value="access" className="mt-0 flex-1 min-h-0 overflow-y-auto px-4 pb-20 md:px-6 pt-4">
            <PhoneAccessManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right panel at page level - full height */}
      <RightPanel open={!!panelContent} onClose={closePanel}>
        {panelContent}
      </RightPanel>
    </div>
  );
}
