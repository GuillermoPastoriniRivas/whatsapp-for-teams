"use client";

import { useEffect } from "react";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useOrderStore } from "@/stores/order.store";
import { usePluginStore } from "@/stores/plugin.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { getSocket } from "@/lib/socket";
import { OrderCard } from "./_components/order-card";
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

export default function OrdersPage() {
  const {
    orders,
    statusFilter,
    isLoading,
    fetch,
    setFilter,
    addOrder,
    updateOrder,
    updateStatus,
  } = useOrderStore();
  const hasOrders = usePluginStore((s) => s.has("orders"));
  const { t } = useTranslations();

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6">
        <h1 className="text-xl font-bold mb-3">{t.orders.title}</h1>

        {/* Status filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
          {STATUS_TABS.map((status) => {
            const label = status
              ? (t.orders[status as keyof typeof t.orders] ?? status)
              : t.orders.all;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mb-2 opacity-40" />
            <p className="text-sm">{t.orders.noOrders}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
