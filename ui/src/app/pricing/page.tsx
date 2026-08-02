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
  Zap,
  Crown,
  Building2,
} from "lucide-react";
import { PLAN_SPECS, planFeatures, planPrice } from "@/lib/plans";

const PLANS = [
  { key: "free" as const, icon: MessageSquare, popular: false, contactSales: false },
  { key: "pro" as const, icon: Zap, popular: true, contactSales: false },
  { key: "business" as const, icon: Crown, popular: false, contactSales: false },
  { key: "agencies" as const, icon: Building2, popular: false, contactSales: true },
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
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isFree = plan.key === "free";
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
                    <span className="text-3xl font-bold text-slate-900">
                      {planPrice(plan.key, t.billing)}
                    </span>
                    {PLAN_SPECS[plan.key].priceMonthly > 0 && (
                      <span className="text-sm text-slate-500">
                        {t.billing.perMonth}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t.billing.whatsIncluded}
                </p>
                <ul className="flex-1 space-y-2 mb-6 text-sm">
                  {planFeatures(plan.key, t.billing).map((feature) => (
                    <li key={feature.label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-600">{feature.label}</span>
                        {typeof feature.value === "boolean" ? (
                          feature.value ? (
                            <Check
                              className="h-4 w-4 shrink-0 text-primary"
                              aria-label={t.billing.included}
                            />
                          ) : (
                            <X
                              className="h-4 w-4 shrink-0 text-slate-300"
                              aria-label={t.billing.notIncluded}
                            />
                          )
                        ) : (
                          <span className="text-right font-medium text-slate-900">
                            {feature.value}
                          </span>
                        )}
                      </div>
                      {feature.hint && (
                        <p className="text-[11px] leading-tight text-slate-400">
                          {feature.hint}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full rounded-xl ${
                    plan.popular
                      ? "bg-primary hover:bg-primary/90"
                      : isFree
                      ? "bg-slate-900 hover:bg-slate-800"
                      : ""
                  }`}
                  variant={plan.popular || isFree ? "default" : "outline"}
                  onClick={() => {
                    if (plan.contactSales) {
                      window.open("https://wa.me/5493442670825?text=Hola,%20me%20interesa%20el%20plan%20Agencies", "_blank");
                      return;
                    }
                    if (agent) {
                      router.push(`/settings/billing?plan=${plan.key}`);
                    } else {
                      router.push(`/signup?redirect=/settings/billing&plan=${plan.key}`);
                    }
                  }}
                >
                  {plan.contactSales
                    ? t.billing.contactUs
                    : isFree
                    ? t.billing.startTrial
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
