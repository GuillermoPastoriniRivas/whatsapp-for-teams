"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, PenLine, ShieldCheck } from "lucide-react";
import { AsisLockup } from "@/components/brand/asis-lockup";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";

const MCP_ENDPOINT_URL = "https://api.asis.chat/api/mcp";

const AGENT_CONFIG_SNIPPET = `{
  "mcpServers": {
    "asis": {
      "type": "http",
      "url": "${MCP_ENDPOINT_URL}",
      "headers": {
        "Authorization": "Bearer ak_tu_clave"
      }
    }
  }
}`;

const OPERATE_TOOLS = [
  "list_phone_numbers",
  "list_message_templates",
  "list_conversations",
  "get_conversation",
  "list_conversation_messages",
  "search_contacts",
  "create_contact",
  "send_whatsapp_message",
  "reply_in_conversation",
];

const BUILD_TOOLS = [
  "list_automations",
  "get_automation",
  "create_automation",
  "update_automation_graph",
  "check_automation",
  "simulate_automation",
];

const TOOLS_THAT_REACH_REAL_PEOPLE = new Set(["send_whatsapp_message", "reply_in_conversation"]);

function ToolList({ tools }: { tools: string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {tools.map((tool) => {
        const reachesRealPeople = TOOLS_THAT_REACH_REAL_PEOPLE.has(tool);
        return (
          <li key={tool} className="flex items-center gap-2">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">{tool}</code>
            {reachesRealPeople && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                WhatsApp
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function McpPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const copy = t.mcpPage;

  const differences = [
    { icon: ShieldCheck, title: copy.difference1Title, body: copy.difference1Body },
    { icon: Check, title: copy.difference2Title, body: copy.difference2Body },
    { icon: Check, title: copy.difference3Title, body: copy.difference3Body },
  ];

  const steps = [copy.connectStep1, copy.connectStep2, copy.connectStep3];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-muted/40 to-background">
      <nav className="sticky top-0 z-(--z-nav) border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <AsisLockup size={36} />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button variant="ghost" className="min-h-11 md:min-h-0" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.legal.backToHome}
            </Button>
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center sm:px-6">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {copy.badge}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">{copy.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button size="lg" className="rounded-full px-8" onClick={() => router.push("/developers")}>
            {copy.cta}
          </Button>
          <p className="text-xs text-muted-foreground">{copy.ctaReassurance}</p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">{copy.differenceTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">{copy.differenceSubtitle}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {differences.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">{copy.toolsTitle}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <Eye className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-base font-semibold text-foreground">{copy.toolsOperateTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{copy.toolsOperateBody}</p>
            <ToolList tools={OPERATE_TOOLS} />
          </div>
          <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <PenLine className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-base font-semibold text-foreground">{copy.toolsBuildTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{copy.toolsBuildBody}</p>
            <ToolList tools={BUILD_TOOLS} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-6">
          <h2 className="text-base font-semibold text-foreground">{copy.limitTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.limitBody}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">{copy.connectTitle}</h2>
        <ol className="mx-auto mt-8 max-w-2xl space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="text-sm text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <pre className="mx-auto mt-6 max-w-2xl overflow-x-auto rounded-xl bg-foreground p-4 text-xs text-background">
          <code>{AGENT_CONFIG_SNIPPET}</code>
        </pre>
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted-foreground">{copy.connectScopes}</p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">{copy.finalTitle}</h2>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button size="lg" className="rounded-full px-8" onClick={() => router.push("/developers")}>
            {copy.cta}
          </Button>
          <p className="text-xs text-muted-foreground">{copy.ctaReassurance}</p>
        </div>
      </section>

      <footer className="border-t border-border bg-muted/40 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <p className="text-muted-foreground">&copy; {new Date().getFullYear()} asis.chat</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground md:min-h-0">
              {t.legal.privacy}
            </Link>
            <Link href="/terms" className="flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground md:min-h-0">
              {t.legal.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
