"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentList } from "@/components/admin/agent-list";
import { PhoneNumberList } from "@/components/admin/phone-number-list";
import { PhoneAccessManager } from "@/components/admin/phone-access-manager";
import { AiAgentList } from "@/components/admin/ai-agent-list";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();

  useEffect(() => {
    if (agent && agent.role !== "admin") {
      router.push("/");
    }
  }, [agent, router]);

  if (agent?.role !== "admin") return null;

  return (
    <div className="h-full overflow-y-auto p-4 pb-20 md:p-6">
      <h1 className="text-xl font-bold mb-4">Admin Panel</h1>
      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="ai-agents">AI Agents</TabsTrigger>
          <TabsTrigger value="phones">Phone Numbers</TabsTrigger>
          <TabsTrigger value="access">Phone Access</TabsTrigger>
        </TabsList>
        <TabsContent value="agents" className="mt-4">
          <AgentList />
        </TabsContent>
        <TabsContent value="ai-agents" className="mt-4">
          <AiAgentList />
        </TabsContent>
        <TabsContent value="phones" className="mt-4">
          <PhoneNumberList />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <PhoneAccessManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
