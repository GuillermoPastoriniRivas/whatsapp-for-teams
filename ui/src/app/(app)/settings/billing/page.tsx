"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreditCard,
  Zap,
  Crown,
  Building2,
  MessageSquare,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import type { PlanTier } from "@/types";

const PLAN_ORDER: PlanTier[] = ["free", "pro", "business", "agencies"];
const PLAN_ICONS: Record<PlanTier, typeof MessageSquare> = {
  free: MessageSquare,
  pro: Zap,
  business: Crown,
  agencies: Building2,
};

export default function BillingPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
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

  const planNames: Record<PlanTier, string> = {
    free: t.billing.freePlan,
    pro: t.billing.proPlan,
    business: t.billing.businessPlan,
    agencies: t.billing.agenciesPlan,
  };

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

  const formatLimit = (current: number, limit: number) => {
    if (limit === -1) return `${current} / ${t.billing.unlimited}`;
    return `${current} / ${limit}`;
  };

  const usagePercent = (current: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  if (agent?.role !== "admin") return null;

  return (
    <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t.billing.title}</h1>
        </div>
      </div>

      {/* Trial Expired Banner */}
      {subscription?.status === "expired" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">{t.billing.trialExpired}</p>
          <p>{t.billing.trialExpiredMessage}</p>
        </div>
      )}

      {/* Current Plan + Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.billing.currentPlan}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = PLAN_ICONS[plan];
                  return (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  );
                })()}
                <div>
                  <p className="font-bold text-lg">{planNames[plan]}</p>
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
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <span>
                  {t.billing.scheduledDowngrade}{" "}
                  <strong>{planNames[subscription.scheduledPlan]}</strong>{" "}
                  {t.billing.scheduledOn}{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-amber-800 hover:bg-amber-100"
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
              </div>
            )}
            {subscription && subscription.status === "active" && plan !== "free" && !subscription.scheduledPlan && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
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

        {/* Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.billing.usage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage && (
              <>
                {(
                  [
                    { label: t.billing.phoneNumbers, data: usage.phoneNumbers },
                    { label: t.billing.humanAgents, data: usage.humanAgents },
                    { label: t.billing.aiBots, data: usage.aiBots },
                    {
                      label: t.billing.conversations,
                      data: usage.conversations,
                    },
                  ] as const
                ).map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="font-medium">
                        {formatLimit(item.data.current, item.data.limit)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePercent(item.data.current, item.data.limit) >= 100
                            ? "bg-amber-500"
                            : usagePercent(item.data.current, item.data.limit) >=
                              80
                            ? "bg-amber-400"
                            : "bg-primary"
                        }`}
                        style={{
                          width: `${usagePercent(item.data.current, item.data.limit)}%`,
                        }}
                      />
                    </div>
                    {!item.data.allowed && (
                      <p className="text-xs text-amber-600 font-medium">
                        {t.billing.limitReached} — {t.billing.upgradeToAdd}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.billing.changePlan}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_ORDER.map((tierKey) => {
              const isCurrent = tierKey === plan;
              const isScheduled = subscription?.scheduledPlan === tierKey;
              const Icon = PLAN_ICONS[tierKey];
              const tierIdx = PLAN_ORDER.indexOf(tierKey);
              const currentIdx = PLAN_ORDER.indexOf(plan);
              const isUpgrade = tierIdx > currentIdx;

              return (
                <div
                  key={tierKey}
                  className={`rounded-xl border p-4 flex flex-col ${
                    isCurrent
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : isScheduled
                      ? "border-amber-300 bg-amber-50/50 ring-1 ring-amber-200"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">
                      {planNames[tierKey]}
                    </span>
                  </div>
                  {isCurrent ? (
                    <Badge variant="secondary" className="self-start mt-auto">
                      {t.billing.currentBadge}
                    </Badge>
                  ) : isScheduled ? (
                    <Badge variant="outline" className="self-start mt-auto bg-amber-50 text-amber-700 border-amber-200">
                      {t.billing.scheduled}
                    </Badge>
                  ) : tierKey === "agencies" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto"
                      onClick={() => window.open("https://wa.me/5493442670825?text=Hola,%20me%20interesa%20el%20plan%20Agencies", "_blank")}
                    >
                      {t.billing.contactUs}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={isUpgrade ? "default" : "outline"}
                      className="mt-auto"
                      disabled={pendingPlan !== null}
                      onClick={() => handlePlanAction(tierKey)}
                    >
                      {pendingPlan === tierKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isUpgrade ? (
                        t.billing.upgrade
                      ) : (
                        t.billing.downgrade
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.billing.billingHistory}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.billing.noHistory}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{t.billing.date}</th>
                    <th className="pb-2 pr-4 font-medium">
                      {t.billing.event}
                    </th>
                    <th className="pb-2 pr-4 font-medium">{t.billing.plan}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        {eventLabels[record.eventType] || record.eventType}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="capitalize">
                          {record.plan}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
