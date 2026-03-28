"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!agent && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hydrated, agent, pathname, router]);

  if (!hydrated) return null;

  return <>{children}</>;
}
