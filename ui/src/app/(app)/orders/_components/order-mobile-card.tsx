"use client";

import Link from "next/link";
import {
  MapPin,
  Store,
  Clock,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";
import { STATUS_CONFIG, timeAgo } from "./order-constants";
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
  const currency = order.currency ?? "$";
  const isDelivery = order.deliveryType === "delivery";
  const deliveryCost = order.deliveryCost ?? null;
  const missingDeliveryCost = isDelivery && deliveryCost == null;
  const itemsSubtotal =
    order.estimatedTotal != null && deliveryCost != null
      ? order.estimatedTotal - deliveryCost
      : null;

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

      {/* Order details */}
      <div className="space-y-1.5 text-sm">
        {/* Items - full list, no truncation */}
        <div className="space-y-0.5">
          {order.items.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  {item.quantity}x {item.name}
                </span>
                {item.unitPrice != null && (
                  <span className="text-xs">
                    {order.currency ?? "$"} {(item.quantity * item.unitPrice).toLocaleString()}
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="text-xs text-muted-foreground/70 italic ml-4">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Delivery type + address */}
        <div className="flex items-start gap-1 text-muted-foreground">
          {isDelivery ? (
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          ) : (
            <Store className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <span>
            {isDelivery ? t.orders.delivery : t.orders.pickup}
            {isDelivery && order.deliveryAddress && ` — ${order.deliveryAddress}`}
            {isDelivery && order.neighborhood && ` (${order.neighborhood})`}
          </span>
        </div>

        {/* Delivery notes */}
        {order.deliveryNotes && (
          <p className="text-xs text-muted-foreground italic">
            {order.deliveryNotes}
          </p>
        )}

        {/* Missing delivery cost alert */}
        {missingDeliveryCost && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{t.orders.missingDeliveryCost}</span>
          </div>
        )}

        {/* Total (with breakdown) */}
        {order.estimatedTotal != null && (
          <div className="space-y-0.5 pt-1 text-xs tabular-nums">
            {isDelivery && deliveryCost != null && itemsSubtotal != null && (
              <>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t.orders.subtotal}</span>
                  <span>
                    {currency} {itemsSubtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t.orders.deliveryCost}</span>
                  <span>
                    {currency} {deliveryCost.toLocaleString()}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-sm border-t pt-1">
              <span className="text-muted-foreground">{t.orders.total}</span>
              <span className="font-semibold">
                {currency} {order.estimatedTotal.toLocaleString()}
              </span>
            </div>
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
