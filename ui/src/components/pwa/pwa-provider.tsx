"use client";

import { useEffect, useState } from "react";
import { Bell, Download, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import {
  isPushSupported,
  isIOS,
  isStandalone,
  getPushSubscription,
  subscribeToPush,
} from "@/lib/push";

const INSTALL_DISMISSED_KEY = "pwa-install-dismissed";
const PUSH_DISMISSED_KEY = "push-prompt-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Registra el service worker y muestra, como máximo, un banner:
 * instalar la app (Chromium/iOS) o activar notificaciones push.
 */
export function PwaProvider() {
  const agent = useAuthStore((s) => s.agent);
  const { t } = useTranslations();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [banner, setBanner] = useState<"install" | "install-ios" | "push" | null>(
    null
  );
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!agent) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      const installDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
      const pushDismissed = localStorage.getItem(PUSH_DISMISSED_KEY);

      if (!isStandalone() && !installDismissed) {
        if (installEvent) {
          setBanner("install");
          return;
        }
        if (isIOS()) {
          setBanner("install-ios");
          return;
        }
      }

      if (
        isPushSupported() &&
        Notification.permission === "default" &&
        !pushDismissed &&
        // En iOS el push solo funciona con la app instalada
        (!isIOS() || isStandalone())
      ) {
        const existing = await getPushSubscription();
        if (!existing && !cancelled) setBanner("push");
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [agent, installEvent]);

  if (!agent || !banner) return null;

  const dismiss = () => {
    localStorage.setItem(
      banner === "push" ? PUSH_DISMISSED_KEY : INSTALL_DISMISSED_KEY,
      "1"
    );
    setBanner(null);
  };

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setBanner(null);
  };

  const handleEnablePush = async () => {
    setEnabling(true);
    try {
      await subscribeToPush();
    } catch {
      // permiso denegado o error de red: no insistir
    } finally {
      setEnabling(false);
      setBanner(null);
    }
  };

  const isPush = banner === "push";

  return (
    <div className="fixed left-4 right-4 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 md:left-auto md:right-4 md:max-w-sm rounded-xl border bg-card text-card-foreground p-4 shadow-lg">
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        aria-label={t.pwa.installDismiss}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isPush ? <Bell className="h-4.5 w-4.5" /> : <Download className="h-4.5 w-4.5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isPush ? t.pwa.pushPromptTitle : t.pwa.installTitle}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPush
              ? t.pwa.pushPromptBody
              : banner === "install-ios"
                ? t.pwa.iosInstructions
                : t.pwa.installBody}
          </p>
          <div className="mt-3 flex gap-2">
            {banner === "install" && (
              <Button size="sm" onClick={handleInstall}>
                {t.pwa.installAction}
              </Button>
            )}
            {isPush && (
              <Button size="sm" onClick={handleEnablePush} disabled={enabling}>
                {t.pwa.pushPromptAccept}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {isPush ? t.pwa.pushPromptDismiss : t.pwa.installDismiss}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
