"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AsisLogo } from "@/components/brand/asis-logo";
import {
  Check,
  X,
  ArrowLeft,
  MessageSquare,
  Users,
  Bot,
  Zap,
  Crown,
  Building2,
} from "lucide-react";

const PLANS = [
  {
    key: "free" as const,
    price: 0,
    icon: MessageSquare,
    popular: false,
  },
  {
    key: "pro" as const,
    price: 49,
    icon: Zap,
    popular: true,
  },
  {
    key: "business" as const,
    price: 99,
    icon: Crown,
    popular: false,
  },
  {
    key: "agencies" as const,
    price: 299,
    icon: Building2,
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();

  const planNames: Record<string, string> = {
    free: t.billing.freePlan,
    pro: t.billing.proPlan,
    business: t.billing.businessPlan,
    agencies: t.billing.agenciesPlan,
  };

  const features = [
    {
      label: t.billing.phoneNumbers,
      values: ["1", t.billing.unlimited, t.billing.unlimited, t.billing.unlimited],
    },
    {
      label: t.billing.humanAgents,
      values: ["2", t.billing.unlimited, t.billing.unlimited, t.billing.unlimited],
    },
    {
      label: t.billing.aiBots,
      values: ["1", "3", t.billing.unlimited, t.billing.unlimited],
    },
    {
      label: t.billing.conversations,
      values: ["50", t.billing.unlimited, t.billing.unlimited, t.billing.unlimited],
    },
    {
      label: t.billing.webhooks,
      values: [false, true, true, true],
    },
    {
      label: t.billing.apiAccess,
      values: [false, false, true, true],
    },
    {
      label: t.billing.whiteLabel,
      values: [false, false, false, true],
    },
    {
      label: t.billing.prioritySupport,
      values: [false, false, true, t.billing.dedicatedSupport],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <AsisLogo size={36} className="text-primary" />
            <span className="text-xl font-bold tracking-tight text-slate-900 -ml-1">
              asis<span className="text-primary">.chat</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button variant="ghost" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.landing.navHowItWorks ? "Inicio" : "Home"}
            </Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {t.billing.pricingTitle}
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          {t.billing.pricingSubtitle}
        </p>
      </div>

      {/* Plan Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan, idx) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border bg-white p-6 shadow-sm flex flex-col ${
                  plan.popular
                    ? "border-primary ring-2 ring-primary/20 shadow-lg"
                    : "border-slate-200"
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1">
                    {t.billing.mostPopular}
                  </Badge>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        plan.popular
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {planNames[plan.key]}
                    </h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-500 text-sm">
                        {t.billing.perMonth}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3 mb-6">
                  {features.map((feature, fIdx) => {
                    const val = feature.values[idx];
                    const isIncluded = val !== false;
                    return (
                      <div
                        key={feature.label}
                        className="flex items-center gap-2 text-sm"
                      >
                        {isIncluded ? (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-300 shrink-0" />
                        )}
                        <span
                          className={
                            isIncluded ? "text-slate-700" : "text-slate-400"
                          }
                        >
                          {typeof val === "string"
                            ? `${val} ${feature.label.toLowerCase()}`
                            : feature.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <Button
                  className={`w-full rounded-xl ${
                    plan.popular
                      ? "bg-primary hover:bg-primary/90"
                      : plan.price === 0
                      ? "bg-slate-900 hover:bg-slate-800"
                      : ""
                  }`}
                  variant={
                    plan.popular || plan.price === 0 ? "default" : "outline"
                  }
                  onClick={() => {
                    if (agent) {
                      router.push(`/settings/billing?plan=${plan.key}`);
                    } else {
                      router.push(`/signup?redirect=/settings/billing&plan=${plan.key}`);
                    }
                  }}
                >
                  {plan.price === 0
                    ? t.billing.getStarted
                    : t.billing.subscribe}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} asis.chat — {t.landing.footerRights}
        </div>
      </footer>
    </div>
  );
}
