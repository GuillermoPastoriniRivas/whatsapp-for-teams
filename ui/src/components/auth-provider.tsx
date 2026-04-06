"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { onUnauthorized } from "@/lib/api";
import { onSocketAuthError, reconnectSocket } from "@/lib/socket";

function isDemoHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.includes("demo.");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const [hydrated, setHydrated] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);

  useEffect(() => {
    const forceLogout = () => {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    };

    // API 401 already tried refresh internally — if it still fails, log out
    onUnauthorized(forceLogout);

    // Socket auth error — try refresh, reconnect; if fails, log out
    onSocketAuthError(async () => {
      try {
        const { tryRefreshToken } = await import("@/lib/api");
        const newToken = await tryRefreshToken();
        if (newToken) {
          reconnectSocket(newToken);
          return;
        }
      } catch {
        // refresh failed
      }
      forceLogout();
    });

    useAuthStore.getState().hydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    // Auto-login for demo subdomain
    if (!agent && isDemoHost()) {
      setAutoLoggingIn(true);
      useAuthStore
        .getState()
        .demoLogin()
        .then(() => {
          setAutoLoggingIn(false);
          if (useAuthStore.getState().agent) {
            window.location.href = "/conversations";
          }
        })
        .catch(() => {
          setAutoLoggingIn(false);
        });
      return;
    }

    if (!agent && pathname !== "/login") {
      window.location.href = "/login";
      return;
    }

    // Redirect new admins who require onboarding
    if (agent && !isDemoHost() && agent.requiresOnboarding === true && pathname !== "/onboarding") {
      window.location.href = "/onboarding";
      return;
    }
  }, [hydrated, agent, pathname]);

  if (!hydrated || autoLoggingIn) return null;

  return <>{children}</>;
}
