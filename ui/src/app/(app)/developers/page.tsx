"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, KeyRound, Webhook, FlaskConical, ExternalLink } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeysTab } from "@/components/developers/api-keys-tab";
import { WebhooksTab } from "@/components/developers/webhooks-tab";
import { PlaygroundTab } from "@/components/developers/playground-tab";
import { API_BASE, type DeveloperOverview } from "@/components/developers/types";

export default function DevelopersPage() {
  const { t } = useTranslations();
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();
  const [overview, setOverview] = useState<DeveloperOverview | null>(null);

  const isAdmin = agent?.role === "admin";

  useEffect(() => {
    if (agent && !isAdmin) router.replace("/conversations");
  }, [agent, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<DeveloperOverview>("/developer/overview")
      .then(setOverview)
      .catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) return null;

  const docsUrl = `${API_BASE.replace(/\/$/, "")}/docs`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 pb-20 space-y-4 max-w-4xl">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Code2 className="h-5 w-5 text-primary" />
            {t.developers.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.developers.subtitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.developers.docsHint}{" "}
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {docsUrl.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <Tabs defaultValue="keys">
          <TabsList>
            <TabsTrigger value="keys" className="gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {t.developers.tabKeys}
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              {t.developers.tabWebhooks}
            </TabsTrigger>
            <TabsTrigger value="playground" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              {t.developers.tabPlayground}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys">
            <ApiKeysTab overview={overview} />
          </TabsContent>
          <TabsContent value="webhooks">
            <WebhooksTab overview={overview} />
          </TabsContent>
          <TabsContent value="playground">
            <PlaygroundTab overview={overview} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
