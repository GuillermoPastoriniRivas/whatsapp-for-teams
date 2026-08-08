"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { FluwsLogo } from "@/components/brand/fluws-logo";
import { PlanCard } from "@/components/shared/plan-card";
import { PlanComparison } from "@/components/shared/plan-comparison";
import { ArrowLeft } from "lucide-react";
import { PLAN_ORDER } from "@/lib/plans";
import type { PlanTier } from "@/types";

export default function PricingPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();

  /** El CTA de un plan. Lo comparten la tabla de escritorio y las cards de mobile. */
  const planAction = (tier: PlanTier) => {
    const isFree = tier === "free";
    const isPopular = tier === "pro";
    const contactSales = tier === "agencies";
    return (
      <Button
        size="lg"
        // El plan gratis va en oscuro para que el CTA pago siga siendo el que resalta.
        className={`w-full ${isFree ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
        variant={isPopular || isFree ? "default" : "outline"}
        onClick={() => {
          if (contactSales) {
            window.open("https://wa.me/5493442670825?text=Hola,%20me%20interesa%20el%20plan%20Agencies", "_blank");
            return;
          }
          if (agent) {
            router.push(`/settings/billing?plan=${tier}`);
          } else {
            router.push(`/signup?redirect=/settings/billing&plan=${tier}`);
          }
        }}
      >
        {contactSales
          ? t.billing.contactUs
          : isFree
          ? t.billing.startTrial
          : t.billing.subscribe}
      </Button>
    );
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-muted/40 to-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-(--z-nav) border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <FluwsLogo size={36} />
            <span className="text-xl font-bold tracking-tight text-foreground">
              fluws
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button variant="ghost" className="min-h-11 md:min-h-0" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.login.back}
            </Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-8 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {t.billing.pricingTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {t.billing.pricingSubtitle}
        </p>
      </div>

      {/* Planes: tabla comparativa en escritorio, cards apiladas en mobile */}
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <PlanComparison
          className="hidden lg:block"
          highlighted="pro"
          action={planAction}
          caption={t.billing.pricingTitle}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:hidden">
          {PLAN_ORDER.map((tier) => (
            <PlanCard
              key={tier}
              tier={tier}
              highlighted={tier === "pro"}
              action={planAction(tier)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} fluws — {t.landing.footerRights}
        </div>
      </footer>
    </div>
  );
}
