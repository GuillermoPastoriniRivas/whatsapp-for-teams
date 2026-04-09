import type { OrderStatus } from "@/types";

export const STATUS_CONFIG: Record<
  OrderStatus,
  { color: string; next: OrderStatus[] }
> = {
  pending: {
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    next: ["confirmed", "cancelled"],
  },
  confirmed: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    next: ["preparing", "cancelled"],
  },
  preparing: {
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    next: ["ready", "cancelled"],
  },
  ready: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    next: ["on_the_way", "delivered", "cancelled"],
  },
  on_the_way: {
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    next: ["delivered", "cancelled"],
  },
  delivered: {
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    next: [],
  },
  cancelled: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    next: [],
  },
};

export const ACTIVE_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
];

export const TERMINAL_STATUSES = new Set<OrderStatus>(["delivered", "cancelled"]);

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
