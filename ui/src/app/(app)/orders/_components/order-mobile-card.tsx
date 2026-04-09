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
import { STATUS_CONFIG, timeAgo } from "./order-constants";
import { OrderStatusStepper } from "./order-status-stepper";
import type { Order, OrderStatus } from "@/types";

interface OrderMobileCardProps {
  order: Order;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  isCompleted?: boolean;
}

export function OrderMobileCard({
  order,
  onStatusChange,
  isCompleted,
}: OrderMobileCardProps) {
  const { t } = useTranslations();
  const config = STATUS_CONFIG[order.status];
  const statusLabel =
    t.orders[order.status as keyof typeof t.orders] ?? order.status;

  return (
    <div className="border rounded-lg p-3 bg-card space-y-2.5">
      {/* Header: Contact + status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium text-sm truncate">
            {order.contactName ?? `#${order.id.slice(-6)}`}
          </p>
          <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt)}
          </span>
        </div>
        <Badge
          variant="secondary"
          className={`text-xs font-medium shrink-0 ${config.color}`}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Stepper (active only) */}
      {!isCompleted && <OrderStatusStepper status={order.status} />}

      {/* Order details */}
      <div className="space-y-1.5 text-sm">
        {/* Items - full list, no truncation */}
        <div className="space-y-0.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-muted-foreground">
              <span>
                {item.quantity}x {item.name}
              </span>
              {item.unitPrice != null && (
                <span className="text-xs">
                  {order.currency ?? "$"} {(item.quantity * item.unitPrice).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Delivery type + address */}
        <div className="flex items-start gap-1 text-muted-foreground">
          {order.deliveryType === "delivery" ? (
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          ) : (
            <Store className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <span>
            {order.deliveryType === "delivery"
              ? t.orders.delivery
              : t.orders.pickup}
            {order.deliveryAddress && ` — ${order.deliveryAddress}`}
          </span>
        </div>

        {/* Delivery notes */}
        {order.deliveryNotes && (
          <p className="text-xs text-muted-foreground italic">
            {order.deliveryNotes}
          </p>
        )}

        {/* Total */}
        {order.estimatedTotal != null && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">{t.orders.total}</span>
            <span className="font-semibold">
              {order.currency ?? "$"} {order.estimatedTotal.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t">
        <div className="flex flex-wrap gap-1.5">
          {!isCompleted &&
            config.next.map((nextStatus) => {
              const nextLabel =
                t.orders[nextStatus as keyof typeof t.orders] ?? nextStatus;
              const isCancelAction = nextStatus === "cancelled";
              return (
                <Button
                  key={nextStatus}
                  size="sm"
                  variant={isCancelAction ? "ghost" : "outline"}
                  className={`h-7 text-xs ${
                    isCancelAction ? "text-red-600 hover:text-red-700" : ""
                  }`}
                  onClick={() => onStatusChange(order.id, nextStatus)}
                >
                  {nextLabel}
                  {!isCancelAction && (
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  )}
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
