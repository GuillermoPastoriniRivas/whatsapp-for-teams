"use client";

import Link from "next/link";
import {
  MapPin,
  Store,
  Clock,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { Order, OrderStatus } from "@/types";

const STATUS_CONFIG: Record<
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface OrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const { t } = useTranslations();
  const config = STATUS_CONFIG[order.status];
  const statusLabel = t.orders[order.status as keyof typeof t.orders] ?? order.status;

  const itemsSummary = order.items
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow">
      {/* Header: contact + status + time */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {order.contactName ?? `#${order.id.slice(-6)}`}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={`text-xs font-medium ${
              order.deliveryType === "delivery"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
            }`}
          >
            {order.deliveryType === "delivery" ? (
              <MapPin className="h-3 w-3 mr-1" />
            ) : (
              <Store className="h-3 w-3 mr-1" />
            )}
            {order.deliveryType === "delivery"
              ? t.orders.delivery
              : t.orders.pickup}
          </Badge>
          <Badge variant="secondary" className={`text-xs font-medium ${config.color}`}>
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Items */}
      <p className="text-sm text-muted-foreground truncate mb-2">
        {itemsSummary}
      </p>

      {/* Address */}
      {order.deliveryAddress && (
        <p className="text-xs text-muted-foreground truncate mb-2 flex items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          {order.deliveryAddress}
        </p>
      )}

      {/* Total */}
      {order.estimatedTotal != null && (
        <p className="text-sm font-semibold mb-3">
          {order.currency ?? "$"} {order.estimatedTotal.toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <div className="flex flex-wrap gap-1.5">
          {config.next.map((nextStatus) => {
            const nextLabel = t.orders[nextStatus as keyof typeof t.orders] ?? nextStatus;
            const isCancelAction = nextStatus === "cancelled";
            return (
              <Button
                key={nextStatus}
                size="sm"
                variant={isCancelAction ? "ghost" : "outline"}
                className={`h-7 text-xs ${isCancelAction ? "text-red-600 hover:text-red-700" : ""}`}
                onClick={() => onStatusChange(order.id, nextStatus)}
              >
                {nextLabel}
                {!isCancelAction && <ChevronRight className="h-3 w-3 ml-0.5" />}
              </Button>
            );
          })}
        </div>

        <Link
          href={`/conversations/${order.conversationId}`}
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <MessageSquare className="h-3 w-3" />
          {t.orders.viewConversation}
        </Link>
      </div>
    </div>
  );
}
