"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Bot,
  Users,
  ArrowRight,
  Sparkles,
  Lock,
  MessageCircle,
  LayoutDashboard,
  Phone,
  Shield,
  Megaphone,
  BarChart3,
  Workflow,
  Zap,
  GitBranch,
  Flag,
  Code2,
  Webhook,
  KeyRound,
  TerminalSquare,
} from "lucide-react";
import { FluwsLogo } from "@/components/brand/fluws-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PlanCard } from "@/components/shared/plan-card";
import { PlanComparison } from "@/components/shared/plan-comparison";
import { PLAN_ORDER } from "@/lib/plans";
import type { PlanTier } from "@/types";
import { legalEntityLine } from "@/lib/legal-entity";

const FOOTER_LINK = "text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground";

/** Nodo del mock del editor de flujos. Los tonos siguen las categorías reales. */
function FlowNode({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Bot;
  label: string;
  tone: "trigger" | "ai" | "action";
}) {
  const tones = {
    trigger: "border-primary/30 bg-primary/10 text-primary",
    ai: "border-accent/30 bg-accent/10 text-accent",
    action: "border-border bg-card text-foreground",
  } as const;

  return (
    <div className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex h-6 flex-col items-center justify-center">
      <div className="h-full w-px bg-border" />
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [hydrated, setHydrated] = useState(false);
  const { t } = useTranslations();

  const handleDemoLogin = async (target = "/conversations") => {
    await demoLogin();
    router.push(target);
  };

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  /** El CTA de un plan. Lo comparten la tabla de escritorio y las cards de mobile. */
  const planAction = (tier: PlanTier) => {
    const isFree = tier === "free";
    const isPopular = tier === "pro";
    const isAgencies = tier === "agencies";
    return (
      <Button
        size="lg"
        // El plan gratis va en oscuro para que el CTA pago siga siendo el que resalta.
        className={`w-full ${isFree ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
        variant={isPopular || isFree ? "default" : "outline"}
        onClick={() => {
          if (isAgencies) {
            window.open(
              "https://wa.me/5493442670825?text=Hola,%20me%20interesa%20el%20plan%20Agencies",
              "_blank",
            );
            return;
          }
          if (agent) {
            router.push("/settings/billing");
          } else {
            router.push("/signup");
          }
        }}
      >
        {isAgencies
          ? t.billing.contactUs
          : isFree
          ? t.billing.getStarted
          : t.billing.subscribe}
      </Button>
    );
  };

  // Automatizaciones y API son las dos patas que la landing no mostraba.
  const automationItems = [
    { icon: Zap, title: t.landing.autoItem1Title, description: t.landing.autoItem1Desc },
    { icon: GitBranch, title: t.landing.autoItem2Title, description: t.landing.autoItem2Desc },
    { icon: Bot, title: t.landing.autoItem3Title, description: t.landing.autoItem3Desc },
    { icon: Flag, title: t.landing.autoItem4Title, description: t.landing.autoItem4Desc },
  ];

  const devItems = [
    { icon: Code2, title: t.landing.dev1Title, description: t.landing.dev1Desc },
    { icon: Webhook, title: t.landing.dev2Title, description: t.landing.dev2Desc, hint: t.landing.dev2Hint },
    { icon: KeyRound, title: t.landing.dev3Title, description: t.landing.dev3Desc },
    { icon: TerminalSquare, title: t.landing.dev4Title, description: t.landing.dev4Desc },
  ];

  // El orden importa: la promesa es automatizar, asi que la IA va primera y
  // la bandeja compartida queda como soporte, no al reves.
  const features = [
    {
      icon: Bot,
      title: t.landing.feature1Title,
      description: t.landing.feature1Desc,
    },
    {
      icon: MessageSquare,
      title: t.landing.feature2Title,
      description: t.landing.feature2Desc,
    },
    {
      icon: Megaphone,
      title: t.landing.feature3Title,
      description: t.landing.feature3Desc,
    },
    {
      icon: Users,
      title: t.landing.feature4Title,
      description: t.landing.feature4Desc,
    },
    {
      icon: Shield,
      title: t.landing.feature5Title,
      description: t.landing.feature5Desc,
    },
    {
      icon: BarChart3,
      title: t.landing.feature6Title,
      description: t.landing.feature6Desc,
      comingSoon: true,
    },
  ];

  const steps = [
    {
      number: "01",
      icon: Phone,
      title: t.landing.step1Title,
      description: t.landing.step1Desc,
    },
    {
      number: "02",
      icon: Bot,
      title: t.landing.step2Title,
      description: t.landing.step2Desc,
    },
    {
      number: "03",
      icon: Users,
      title: t.landing.step3Title,
      description: t.landing.step3Desc,
    },
    {
      number: "04",
      icon: Megaphone,
      title: t.landing.step4Title,
      description: t.landing.step4Desc,
    },
  ];

  useEffect(() => {
    useAuthStore.getState().hydrate();
    setHydrated(true);

    // Skip landing page on demo subdomain
    const isDemo =
      typeof window !== "undefined" && window.location.hostname.includes("demo.");
    if (isDemo) {
      router.replace("/conversations");
      return;
    }
  }, [router]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-muted/40 font-sans text-foreground selection:bg-primary/20 selection:text-primary-foreground">
      {/* Patrones de fondo */}
      <div className="fixed inset-0 -z-10 bg-muted/40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute left-[15%] top-[10%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute right-[15%] top-[40%] h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px]"></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 z-(--z-nav) w-full border-b border-border/60 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <FluwsLogo size={30} className="sm:hidden" />
            <FluwsLogo size={36} className="hidden sm:block" />
            <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Fluws</span>
          </div>

          <div className="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex lg:gap-8">
            <button onClick={() => scrollTo("como-funciona")} className="transition-colors hover:text-primary">
              {t.landing.navHowItWorks}
            </button>
            <button onClick={() => scrollTo("funcionalidades")} className="transition-colors hover:text-primary">
              {t.landing.navFeatures}
            </button>
            {/* A 768px el navbar ya está justo: estos dos aparecen recién en lg. */}
            <button onClick={() => scrollTo("automatizaciones")} className="hidden transition-colors hover:text-primary lg:block">
              {t.landing.navAutomations}
            </button>
            <button onClick={() => scrollTo("desarrolladores")} className="hidden transition-colors hover:text-primary lg:block">
              {t.landing.navDevelopers}
            </button>
            <button onClick={() => scrollTo("precios")} className="transition-colors hover:text-primary">
              {t.landing.navPricing}
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <ThemeToggle />
            <LanguageToggle />
            {hydrated && agent ? (
              <Button
                size="lg"
                className="rounded-full shadow-md shadow-primary/20"
                onClick={() => router.push("/conversations")}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {t.landing.navWorkspace}
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-muted-foreground hover:text-foreground md:min-h-0"
                  onClick={() => router.push("/login")}
                >
                  {t.landing.navLogin}
                </Button>
                <Button
                  size="lg"
                  className="hidden rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-105 hover:bg-foreground/90 sm:inline-flex"
                  disabled={isLoading}
                  onClick={() => handleDemoLogin()}
                >
                  {t.landing.navDemo}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              <span>{t.landing.badge}</span>
            </div>
            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-foreground min-[420px]:text-5xl sm:text-7xl">
              {t.landing.heroTitle}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t.landing.heroTitleHighlight}</span>{t.landing.heroTitleEnd}
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              {t.landing.heroSubtitle}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-14 rounded-full px-8 text-base shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:bg-primary/90"
                disabled={isLoading}
                onClick={() => handleDemoLogin()}
              >
                {t.landing.ctaDemo}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14 rounded-full px-8 text-base shadow-sm"
                onClick={() => {
                  document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                {t.landing.ctaHowItWorks}
              </Button>
            </div>
            {/* Baja el riesgo percibido justo donde se decide el clic. */}
            <p className="mt-4 text-sm text-muted-foreground">{t.landing.ctaReassurance}</p>
          </div>

          {/* Product Mockup */}
          <div className="relative mx-auto mt-20 max-w-5xl rounded-xl border border-border/80 bg-card/60 shadow-2xl shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200 fill-mode-both sm:mt-24 lg:p-2">
            <div className="absolute -top-px left-1/2 h-[2px] w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex h-12 items-center gap-2 border-b border-border bg-muted/50 px-4">
                {/* Botones de ventana: color de ilustración, no del tema. */}
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="mx-auto flex h-6 max-w-[200px] flex-1 items-center justify-center rounded-md border border-border bg-card px-3 text-xs text-muted-foreground shadow-sm">
                  <Lock className="mr-1.5 h-3 w-3" /> app.fluws.com
                </div>
                <div className="flex gap-1.5 opacity-0">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
              </div>
              <div className="flex h-[400px] w-full bg-card md:h-[600px]">
                {/* Sidebar mock */}
                <div className="hidden w-64 flex-col border-r border-border bg-muted/50 md:flex">
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <FluwsLogo size={32} />
                    <div className="h-4 w-24 rounded bg-muted-foreground/20" />
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="flex h-9 w-full items-center gap-3 rounded-md border border-border bg-card px-3 shadow-sm">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <div className="h-3 w-20 rounded bg-foreground/70" />
                    </div>
                    <div className="flex h-9 w-full items-center gap-3 rounded-md px-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="h-3 w-16 rounded bg-muted-foreground/30" />
                    </div>
                    <div className="flex h-9 w-full items-center gap-3 rounded-md px-3">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <div className="h-3 w-24 rounded bg-muted-foreground/30" />
                    </div>
                  </div>
                </div>
                {/* Chat List mock */}
                <div className="hidden w-80 flex-col border-r border-border bg-card sm:flex">
                  <div className="border-b border-border bg-muted/30 p-4">
                    <div className="flex h-9 w-full items-center rounded-md border border-border bg-card px-3 shadow-sm">
                      <div className="h-3 w-32 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                  <div className="space-y-2 p-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${i === 1 ? 'border border-primary/10 bg-primary/5' : 'hover:bg-muted/50'}`}>
                        <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-gradient-to-br from-primary/20 to-accent/20" />
                        <div className="w-full space-y-2">
                          <div className="flex w-full justify-between">
                            <div className={`h-3 w-24 rounded ${i === 1 ? 'bg-foreground/70' : 'bg-muted-foreground/40'}`} />
                            <div className="h-2 w-8 rounded bg-muted-foreground/30" />
                          </div>
                          <div className={`h-2 w-32 rounded ${i === 1 ? 'bg-muted-foreground/60' : 'bg-muted-foreground/30'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Chat Area mock */}
                <div className="relative flex flex-1 flex-col overflow-hidden bg-muted/40">
                   <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--foreground) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                   <div className="z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)]">
                     <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-full border border-border bg-gradient-to-br from-primary/20 to-accent/20" />
                       <div className="space-y-1.5">
                         <div className="h-3 w-32 rounded bg-foreground/70" />
                         <div className="h-2 w-20 rounded bg-primary/60" />
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <div className="h-8 w-8 rounded border border-border bg-card" />
                       <div className="h-8 w-8 rounded border border-border bg-card" />
                     </div>
                   </div>

                   <div className="z-10 flex-1 space-y-6 p-6">
                      <div className="flex max-w-[80%] gap-3">
                        <div className="h-8 w-8 shrink-0 rounded-full border border-border bg-muted-foreground/20" />
                        <div className="space-y-2 rounded-xl rounded-tl-sm border border-border bg-card p-4 shadow-sm">
                           <div className="h-3 w-48 rounded bg-muted-foreground/60" />
                           <div className="h-3 w-32 rounded bg-muted-foreground/40" />
                        </div>
                      </div>

                      <div className="ml-auto flex max-w-[80%] justify-end gap-3">
                        <div className="space-y-2 rounded-xl rounded-tr-sm border border-primary/20 bg-primary/10 p-4 shadow-sm">
                           <div className="h-3 w-56 rounded bg-primary/70" />
                           <div className="h-3 w-40 rounded bg-primary/60" />
                        </div>
                      </div>

                      <div className="ml-auto flex max-w-[80%] justify-end gap-3">
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-xs text-muted-foreground shadow-sm">
                           <Bot className="h-3 w-3 text-primary" />
                           <span>{t.landing.aiSuggestion}</span>
                        </div>
                      </div>
                   </div>

                   <div className="z-10 border-t border-border bg-card p-4">
                     <div className="flex h-12 w-full items-center justify-between rounded-lg border border-border bg-muted/50 px-4 shadow-inner">
                       <div className="h-3 w-40 rounded bg-muted-foreground/30" />
                       <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                         <Bot className="h-4 w-4" />
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-y border-border bg-background py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-3 text-sm font-bold tracking-wide uppercase text-primary">{t.landing.howItWorksLabel}</h2>
            <p className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {t.landing.howItWorksTitle}
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-center rounded-xl border border-border bg-muted/40 p-6 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                <div className="mb-4 text-5xl font-black text-primary/15">{step.number}</div>
                <div className="mb-4 rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-3 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="relative bg-muted/40 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-3 text-sm font-bold tracking-wide uppercase text-primary">{t.landing.featuresLabel}</h2>
            <p className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {t.landing.featuresTitle}
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <dl className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                  {"comingSoon" in feature && feature.comingSoon && (
                    <span className="absolute top-6 right-6 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent ring-1 ring-accent/20">
                      {t.landing.comingSoon}
                    </span>
                  )}
                  <div className="rounded-xl bg-muted p-3 ring-1 ring-border transition-all group-hover:bg-primary/10 group-hover:ring-primary/20">
                    <feature.icon className="h-6 w-6 text-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <dt className="mt-6 text-xl font-bold text-foreground">
                    {feature.title}
                  </dt>
                  <dd className="mt-3 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Automatizaciones */}
      <section id="automatizaciones" className="border-y border-border bg-background py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-3 text-sm font-bold tracking-wide uppercase text-primary">{t.landing.automationsLabel}</h2>
            <p className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {t.landing.automationsTitle}
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.landing.automationsSubtitle}
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <dl className="space-y-8">
              {automationItems.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="h-fit shrink-0 rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <dt className="text-lg font-bold text-foreground">{item.title}</dt>
                    <dd className="mt-1.5 text-base leading-7 text-muted-foreground">{item.description}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {/* Mock del editor de flujos: un caso real, no un diagrama abstracto. */}
            <div className="rounded-xl border border-border bg-muted/40 p-6 shadow-lg shadow-foreground/5 sm:p-8">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Workflow className="h-4 w-4 text-primary" />
                {t.landing.automationsLabel}
              </div>

              <div className="flex flex-col items-center">
                <FlowNode icon={MessageCircle} label={t.landing.autoFlowTrigger} tone="trigger" />
                <FlowArrow />
                <FlowNode icon={Bot} label={t.landing.autoFlowClassify} tone="ai" />
                <div className="h-6 w-px bg-border" />
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-3">
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-center text-[11px] font-medium text-muted-foreground">
                      {t.landing.autoFlowBranchSales}
                    </span>
                    <FlowNode icon={Megaphone} label={t.landing.autoFlowSalesAction} tone="action" />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-center text-[11px] font-medium text-muted-foreground">
                      {t.landing.autoFlowBranchSupport}
                    </span>
                    <FlowNode icon={MessageSquare} label={t.landing.autoFlowSupportAction} tone="action" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-7"
              disabled={isLoading}
              onClick={() => handleDemoLogin("/flows")}
            >
              {t.landing.autoCta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Para desarrolladores */}
      <section id="desarrolladores" className="bg-muted/40 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-3 text-sm font-bold tracking-wide uppercase text-primary">{t.landing.developersLabel}</h2>
            <p className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {t.landing.developersTitle}
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.landing.developersSubtitle}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{t.landing.devFreeBadge}</span>
            </div>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-2">
            {/* Snippet real: mismo endpoint y misma cabecera que /v1. */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-foreground/5">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">{t.landing.devCodeCaption}</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">POST /v1/messages</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6 text-muted-foreground">
                <code>{`curl -X POST https://api.fluws.com/v1/messages \\
  -H "X-Api-Key: ak_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+5493442670825",
    "text": "Tu pedido #1042 ya salió 🚚"
  }'`}</code>
              </pre>
            </div>

            <dl className="space-y-8">
              {devItems.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="h-fit shrink-0 rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <dt className="flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
                      {item.title}
                      {"hint" in item && item.hint && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                          {item.hint}
                        </span>
                      )}
                    </dt>
                    <dd className="mt-1.5 text-base leading-7 text-muted-foreground">{item.description}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-14 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-7"
              disabled={isLoading}
              onClick={() => handleDemoLogin("/developers")}
            >
              {t.landing.devCta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="border-y border-border bg-background py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-3 text-sm font-bold tracking-wide uppercase text-primary">{t.landing.pricingLabel}</h2>
            <p className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {t.landing.pricingTitle}
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.landing.pricingSubtitle}
            </p>
          </div>

          {/* Escritorio: tabla comparativa — los planes se venden comparándose,
              y cuatro listas paralelas obligan a saltar de una a otra para
              contestar "¿qué me da Pro que no me da Free?". Mobile: las mismas
              filas apiladas, que cinco columnas no entran. */}
          <PlanComparison
            className="mx-auto hidden max-w-6xl lg:block"
            highlighted="pro"
            action={planAction}
            caption={t.landing.pricingTitle}
          />

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:hidden">
            {PLAN_ORDER.map((tier) => (
              <PlanCard
                key={tier}
                tier={tier}
                highlighted={tier === "pro"}
                className="hover:shadow-xl hover:shadow-primary/5"
                action={planAction(tier)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative isolate border-t border-border px-6 py-24 sm:py-32 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/5 via-muted/40 to-muted/40" />
        <div className="mx-auto max-w-4xl text-center">
           <FluwsLogo size={64} className="mx-auto mb-6" />
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {t.landing.ctaTitle}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            {t.landing.ctaSubtitle}
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" className="h-14 rounded-full px-8 text-lg font-semibold shadow-xl shadow-primary/20 transition-transform hover:scale-105 hover:bg-primary/90" disabled={isLoading} onClick={() => handleDemoLogin()}>
              {t.landing.ctaDemo}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t.landing.ctaReassurance}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            <div className="space-y-8">
              <div className="flex items-center gap-2">
                 <FluwsLogo size={32} />
                 <span className="text-xl font-bold text-foreground">Fluws</span>
              </div>
              <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                {t.landing.footerTagline}
              </p>
            </div>
            <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm leading-6 font-semibold text-foreground">{t.landing.footerProduct}</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><button onClick={() => scrollTo("como-funciona")} className={FOOTER_LINK}>{t.landing.navHowItWorks}</button></li>
                    <li><button onClick={() => scrollTo("funcionalidades")} className={FOOTER_LINK}>{t.landing.navFeatures}</button></li>
                    <li><button onClick={() => scrollTo("automatizaciones")} className={FOOTER_LINK}>{t.landing.navAutomations}</button></li>
                    <li><button onClick={() => scrollTo("desarrolladores")} className={FOOTER_LINK}>{t.landing.navDevelopers}</button></li>
                    <li><a href="/pricing" className={FOOTER_LINK}>{t.landing.navPricing}</a></li>
                  </ul>
                </div>
                <div className="mt-10 md:mt-0">
                  <h3 className="text-sm leading-6 font-semibold text-foreground">{t.landing.footerStart}</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><button onClick={() => handleDemoLogin()} className={FOOTER_LINK}>{t.landing.footerDemo}</button></li>
                    <li><a href="/signup" className={FOOTER_LINK}>{t.landing.footerSignup}</a></li>
                    <li><a href="/login" className={FOOTER_LINK}>{t.landing.navLogin}</a></li>
                  </ul>
                </div>
              </div>
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm leading-6 font-semibold text-foreground">{t.landing.footerCompany}</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><a href="mailto:contact@fluws.com" className={FOOTER_LINK}>{t.landing.footerContact}</a></li>
                    <li><a href="https://wa.me/5493442670825" target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>{t.landing.footerWhatsapp}</a></li>
                    <li><a href="https://www.linkedin.com/in/guillermopastorini/" target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>{t.landing.footerLinkedin}</a></li>
                  </ul>
                </div>
                <div className="mt-10 md:mt-0">
                  <h3 className="text-sm leading-6 font-semibold text-foreground">{t.landing.footerLegal}</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><a href="/privacy" className={FOOTER_LINK}>{t.landing.footerPrivacy}</a></li>
                    <li><a href="/terms" className={FOOTER_LINK}>{t.landing.footerTerms}</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-16 border-t border-border pt-8 text-center sm:mt-20 lg:mt-24">
            <p className="text-sm leading-5 text-muted-foreground">
              &copy; {new Date().getFullYear()} Fluws — {t.landing.footerRights} Construido por{" "}
              <a href="https://www.linkedin.com/in/guillermopastorini/" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground transition-colors hover:text-primary">Guillermo</a>.
            </p>
            {/* Nombre legal del titular: la verificacion de negocio de Meta
                rechaza el dominio si no puede atarlo a la documentacion. */}
            <p className="mt-2 text-xs text-muted-foreground">
              {t.landing.footerOperatedBy}{" "}
              <span className="font-medium text-foreground">{legalEntityLine()}</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp — el verde es la marca de WhatsApp, no del tema. */}
      <a
        href="https://wa.me/5493442670825"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed right-6 bottom-6 z-(--z-nav) flex items-center gap-2 rounded-full bg-[#25D366] py-3 pl-4 pr-5 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 animate-bounce [animation-duration:2s] [animation-iteration-count:3]"
        aria-label={t.landing.whatsappAria}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 shrink-0">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span className="text-sm font-semibold">{t.landing.whatsappCta}</span>
      </a>
    </div>
  );
}
