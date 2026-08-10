"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { InlineNotice } from "@/components/shared/inline-notice";
import { PlanCard, PLAN_ICONS, usePlanNames } from "@/components/shared/plan-card";
import { PlanComparison } from "@/components/shared/plan-comparison";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";
import type { PlanTier } from "@/types";
import { PLAN_ORDER, PLAN_SPECS, planPrice } from "@/lib/plans";

export default function BillingPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const planNames = usePlanNames();
  const [pendingPlan, setPendingPlan] = useState<PlanTier | null>(null);
  const {
    subscription,
    plan,
    usage,
    history,
    isLoading,
    fetchSubscription,
    fetchUsage,
    fetchHistory,
    subscribe,
    changePlan,
    cancelSubscription,
  } = useBillingStore();

  useEffect(() => {
    if (agent?.role !== "admin") {
      router.push("/conversations");
      return;
    }
    fetchSubscription();
    fetchUsage();
    fetchHistory();
  }, [agent]);

  const eventLabels: Record<string, string> = {
    subscription_created: t.billing.subscriptionCreated,
    plan_changed: t.billing.planChanged,
    payment_success: t.billing.paymentSuccess,
    payment_failed: t.billing.paymentFailed,
    subscription_canceled: t.billing.subscriptionCanceled,
    subscription_renewed: t.billing.subscriptionRenewed,
  };

  const handlePlanAction = async (targetPlan: PlanTier) => {
    if (targetPlan === plan || pendingPlan) return;
    setPendingPlan(targetPlan);
    try {
      if (targetPlan === "free") {
        await cancelSubscription();
      } else if (!subscription || subscription.status === "canceled" || subscription.status === "expired") {
        await subscribe(targetPlan);
      } else {
        await changePlan(targetPlan);
      }
      await Promise.all([fetchSubscription(), fetchUsage(), fetchHistory()]);
    } finally {
      setPendingPlan(null);
    }
  };

  /** El CTA de un plan. Lo comparten la tabla de escritorio y las cards de mobile. */
  const planAction = (tierKey: PlanTier) => {
    if (tierKey === plan) {
      return (
        <div className="flex h-10 w-full items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary md:h-8">
          {t.billing.currentBadge}
        </div>
      );
    }
    if (subscription?.scheduledPlan === tierKey) {
      return (
        <div className="flex h-10 w-full items-center justify-center rounded-lg bg-accent/10 text-sm font-medium text-accent md:h-8">
          {t.billing.scheduled}
        </div>
      );
    }
    if (tierKey === "agencies") {
      return (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open("https://wa.me/5493442670825?text=Hola,%20me%20interesa%20el%20plan%20Agencies", "_blank")}
        >
          {t.billing.contactUs}
        </Button>
      );
    }
    const isUpgrade = PLAN_ORDER.indexOf(tierKey) > PLAN_ORDER.indexOf(plan);
    return (
      <Button
        variant={isUpgrade ? "default" : "outline"}
        className="w-full"
        disabled={pendingPlan !== null}
        onClick={() => handlePlanAction(tierKey)}
      >
        {pendingPlan === tierKey ? (
          <Spinner size="sm" className="text-current" />
        ) : isUpgrade ? (
          t.billing.upgrade
        ) : (
          t.billing.downgrade
        )}
      </Button>
    );
  };

  const formatLimit = (current: number, limit: number) => {
    if (limit === -1) return `${current} / ${t.billing.unlimited}`;
    return `${current} / ${limit}`;
  };

  const usagePercent = (current: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  if (agent?.role !== "admin") return null;

  const CurrentPlanIcon = PLAN_ICONS[plan];

  return (
    <PageShell>
      <PageHeader title={t.billing.title} backHref="/settings" />

      <PageContent width="wide">
        <div className="space-y-4 md:space-y-6">
          {subscription?.status === "expired" && (
            <InlineNotice variant="error">
              <p className="font-semibold">{t.billing.trialExpired}</p>
              <p>{t.billing.trialExpiredMessage}</p>
            </InlineNotice>
          )}

          {/* Plan actual + uso */}
          <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.billing.currentPlan}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CurrentPlanIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{planNames[plan]}</p>
                      <p className="text-xs text-muted-foreground">
                        {planPrice(plan, t.billing)}
                        {PLAN_SPECS[plan].priceMonthly > 0 && t.billing.perMonth}
                      </p>
                    </div>
                  </div>
                  {subscription && (
                    <Badge
                      variant={
                        subscription.status === "active" ? "default"
                        : subscription.status === "expired" ? "destructive"
                        : "secondary"
                      }
                    >
                      {subscription.status === "active"
                        ? t.billing.active
                        : subscription.status === "expired"
                        ? t.billing.trialExpired
                        : t.billing.canceled}
                    </Badge>
                  )}
                </div>
                {subscription && subscription.status === "active" && (
                  <div className="text-xs text-muted-foreground">
                    {t.billing.period}:{" "}
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()}{" "}
                    —{" "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                )}
                {subscription?.scheduledPlan && (
                  <InlineNotice variant="warning">
                    <p>
                      {t.billing.scheduledDowngrade}{" "}
                      <strong>{planNames[subscription.scheduledPlan]}</strong>{" "}
                      {t.billing.scheduledOn}{" "}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={isLoading}
                      onClick={async () => {
                        // Cancel scheduled downgrade by "changing" to current plan
                        await changePlan(plan);
                        fetchSubscription();
                        fetchHistory();
                      }}
                    >
                      {t.billing.cancelDowngrade}
                    </Button>
                  </InlineNotice>
                )}
                {subscription && subscription.status === "active" && plan !== "free" && !subscription.scheduledPlan && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        await cancelSubscription();
                        fetchSubscription();
                        fetchHistory();
                      }}
                      disabled={isLoading}
                    >
                      {t.billing.cancelSubscription}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.billing.usage}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!usage && isLoading && <LoadingState className="py-6" />}
                {usage &&
                  (
                    [
                      { label: t.billing.phoneNumbers, data: usage.phoneNumbers },
                      { label: t.billing.humanAgents, data: usage.humanAgents },
                      {
                        label: t.billing.conversations,
                        data: usage.conversations,
                      },
                    ] as const
                  ).map((item) => {
                    const pct = usagePercent(item.data.current, item.data.limit);
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium tabular-nums">
                            {formatLimit(item.data.current, item.data.limit)}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          indicatorClassName={
                            pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-accent" : undefined
                          }
                        />
                        {!item.data.allowed && (
                          <p className="text-xs font-medium text-destructive">
                            {t.billing.limitReached} — {t.billing.upgradeToAdd}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>

          {/* Selector de plan */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold">{t.billing.changePlan}</h2>

            {/* Escritorio: tabla comparativa — cinco columnas no entran antes de
                `lg`. Mobile: las mismas filas, apiladas en cards. */}
            <PlanComparison
              className="hidden lg:block"
              current={plan}
              action={planAction}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
              {PLAN_ORDER.map((tierKey) => (
                <PlanCard
                  key={tierKey}
                  tier={tierKey}
                  current={tierKey === plan}
                  action={planAction(tierKey)}
                  className={
                    subscription?.scheduledPlan === tierKey && tierKey !== plan
                      ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                      : undefined
                  }
                />
              ))}
            </div>
          </section>

          {/* Historial de facturación */}
          <Card>
            <CardHeader>
              <CardTitle>{t.billing.billingHistory}</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={Receipt} title={t.billing.noHistory} className="py-10" />
              ) : (
                <>
                  {/* Escritorio: tabla */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.billing.date}</TableHead>
                          <TableHead>{t.billing.event}</TableHead>
                          <TableHead>{t.billing.plan}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="text-muted-foreground">
                              {new Date(record.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {eventLabels[record.eventType] || record.eventType}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {record.plan}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: cards apiladas */}
                  <div className="space-y-2 md:hidden">
                    {history.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between gap-2 rounded-xl border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {eventLabels[record.eventType] || record.eventType}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(record.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {record.plan}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </PageShell>
  );
}
