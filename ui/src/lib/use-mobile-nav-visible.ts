"use client";

import { usePathname } from "next/navigation";

/**
 * Whether the fixed bottom MobileNav should be shown (and its space reserved)
 * on the current route. Hidden inside an open chat so the composer gets the
 * full bottom edge.
 */
export function useMobileNavVisible(): boolean {
  const pathname = usePathname();
  if (pathname === "/login") return false;
  if (/^\/conversations\/./.test(pathname)) return false;
  return true;
}
