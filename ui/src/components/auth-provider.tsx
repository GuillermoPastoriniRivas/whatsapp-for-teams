"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { onUnauthorized } from "@/lib/api";
import { onSocketAuthError, reconnectSocket } from "@/lib/socket";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const [hydrated, setHydrated] = useState(false);

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
    if (!agent && pathname !== "/login") {
      window.location.href = "/login";
    }
  }, [hydrated, agent, pathname]);

  if (!hydrated) return null;

  return <>{children}</>;
}
