"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Loader2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { useOrderStore } from "@/stores/order.store";
import { usePluginStore } from "@/stores/plugin.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { getSocket } from "@/lib/socket";
import {
  TERMINAL_STATUSES,
  STATUS_CONFIG,
} from "./_components/order-constants";
import { OrderTableRow } from "./_components/order-table-row";
import { OrderMobileCard } from "./_components/order-mobile-card";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

const STATUS_TABS: (OrderStatus | "")[] = [
  "",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
  "cancelled",
];

const PILL_COLORS: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  confirmed:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  preparing:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  ready:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  on_the_way:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  delivered:
    "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  cancelled:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function OrdersPage() {
  const { orders, isLoading, fetch, addOrder, updateOrder, updateStatus } =
    useOrderStore();
  const hasOrders = usePluginStore((s) => s.has("orders"));
  const { t } = useTranslations();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Real-time socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (order: Order) => addOrder(order);
    const handleUpdated = (order: Order) => updateOrder(order);

    socket.on("order.new", handleNew);
    socket.on("order.updated", handleUpdated);

    return () => {
      socket.off("order.new", handleNew);
      socket.off("order.updated", handleUpdated);
    };
  }, [addOrder, updateOrder]);

  const { activeOrders, completedOrders } = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const filtered = statusFilter
      ? sorted.filter((o) => o.status === statusFilter)
      : sorted;
    return {
      activeOrders: filtered.filter((o) => !TERMINAL_STATUSES.has(o.status)),
      completedOrders: filtered.filter((o) => TERMINAL_STATUSES.has(o.status)),
    };
  }, [orders, statusFilter]);

  // Count per status for pills
  const countByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      map[o.status] = (map[o.status] ?? 0) + 1;
    }
    return map;
  }, [orders]);

  if (!hasOrders) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Plugin not enabled</p>
      </div>
    );
  }

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateStatus(orderId, status);
  };

  const columnHeaders = (
    <TableRow>
      <TableHead>{t.orders.contact}</TableHead>
      <TableHead>{t.orders.items}</TableHead>
      <TableHead>{t.orders.deliveryType}</TableHead>
      <TableHead>{t.orders.status}</TableHead>
      <TableHead>{t.orders.total}</TableHead>
      <TableHead>{t.orders.time}</TableHead>
      <TableHead>{t.orders.actions}</TableHead>
    </TableRow>
  );

  const noResults =
    activeOrders.length === 0 && completedOrders.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6">
        <h1 className="text-xl font-bold mb-3">{t.orders.title}</h1>

        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
          {STATUS_TABS.map((status) => {
            const label = status
              ? (t.orders[status as keyof typeof t.orders] ?? status)
              : t.orders.all;
            const isActive = statusFilter === status;
            const count = status ? (countByStatus[status] ?? 0) : orders.length;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5",
                  isActive && status
                    ? PILL_COLORS[status]
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
                <span
                  className={cn(
                    "text-[10px] font-normal",
                    isActive ? "opacity-80" : "opacity-60"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
        {isLoading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : noResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mb-2 opacity-40" />
            <p className="text-sm">{t.orders.noOrders}</p>
          </div>
        ) : (
          <>
            {/* Active orders */}
            {activeOrders.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-3">
                  {t.orders.activeOrders}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({activeOrders.length})
                  </span>
                </h2>
                {/* Desktop: table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>{columnHeaders}</TableHeader>
                    <TableBody>
                      {activeOrders.map((order) => (
                        <OrderTableRow
                          key={order.id}
                          order={order}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile: cards */}
                <div className="md:hidden space-y-2">
                  {activeOrders.map((order) => (
                    <OrderMobileCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed orders */}
            {completedOrders.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-3">
                  {t.orders.completedOrders}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({completedOrders.length})
                  </span>
                </h2>
                {/* Desktop: table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>{columnHeaders}</TableHeader>
                    <TableBody>
                      {completedOrders.map((order) => (
                        <OrderTableRow
                          key={order.id}
                          order={order}
                          onStatusChange={handleStatusChange}
                          isCompleted
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile: cards */}
                <div className="md:hidden space-y-2">
                  {completedOrders.map((order) => (
                    <OrderMobileCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                      isCompleted
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
