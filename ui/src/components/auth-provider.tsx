"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { onUnauthorized } from "@/lib/api";
import { onSocketAuthError, reconnectSocket } from "@/lib/socket";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const forceLogout = () => {
      useAuthStore.getState().logout();
      router.replace("/login");
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
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    if (!agent && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hydrated, agent, pathname, router]);

  if (!hydrated) return null;

  return <>{children}</>;
}
