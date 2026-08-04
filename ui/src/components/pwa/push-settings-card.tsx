"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/use-translations";
import {
  isPushSupported,
  isIOS,
  isStandalone,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

type PushState =
  | "loading"
  | "unsupported"
  | "ios-not-installed"
  | "denied"
  | "enabled"
  | "disabled";

export function PushSettingsCard() {
  const { t } = useTranslations();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const refresh = async () => {
    if (!isPushSupported()) {
      setState(isIOS() && !isStandalone() ? "ios-not-installed" : "unsupported");
      return;
    }
    if (isIOS() && !isStandalone()) {
      setState("ios-not-installed");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const subscription = await getPushSubscription();
    setState(subscription ? "enabled" : "disabled");
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async () => {
    setBusy(true);
    setError(false);
    try {
      if (state === "enabled") {
        await unsubscribeFromPush();
      } else {
        await subscribeToPush();
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          {t.settings.notifications}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{t.settings.pushDescription}</p>

        {state === "loading" && (
          <Spinner size="sm" className="text-muted-foreground" />
        )}

        {state === "unsupported" && (
          <p className="text-muted-foreground">{t.settings.pushUnsupported}</p>
        )}

        {state === "ios-not-installed" && (
          <p className="text-muted-foreground">{t.settings.pushIosInstall}</p>
        )}

        {state === "denied" && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
            {t.settings.pushDenied}
          </p>
        )}

        {state === "enabled" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium text-primary">
              <Bell className="h-4 w-4" />
              {t.settings.pushEnabled}
            </span>
            <Button variant="outline" size="sm" onClick={handleToggle} disabled={busy}>
              {busy && <Spinner size="sm" className="mr-1.5" />}
              {t.settings.pushDisable}
            </Button>
          </div>
        )}

        {state === "disabled" && (
          <Button onClick={handleToggle} disabled={busy} className="w-full sm:w-auto">
            {busy ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Bell className="mr-2 h-4 w-4" />
            )}
            {t.settings.pushEnable}
          </Button>
        )}

        {error && <p className="text-destructive text-xs">{t.settings.pushError}</p>}
      </CardContent>
    </Card>
  );
}
