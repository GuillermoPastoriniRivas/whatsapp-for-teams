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
import { TableRow, TableCell } from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n/use-translations";
import { STATUS_CONFIG, timeAgo } from "./order-constants";
import type { Order, OrderStatus } from "@/types";

interface OrderTableRowProps {
  order: Order;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  isCompleted?: boolean;
}

export function OrderTableRow({
  order,
  onStatusChange,
  isCompleted,
}: OrderTableRowProps) {
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
    <TableRow>
      {/* Contact */}
      <TableCell className="font-medium align-top">
        <div>{order.contactName ?? order.customerName ?? `#${order.id.slice(-6)}`}</div>
        {order.customerPhone && (
          <div className="text-xs font-normal text-muted-foreground mt-0.5">
            {order.customerPhone}
          </div>
        )}
      </TableCell>

      {/* Items (detailed with per-line pricing) */}
      <TableCell className="whitespace-normal text-muted-foreground align-top min-w-[220px]">
        <div className="space-y-0.5">
          {order.items.map((item, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">
                  {item.quantity}x {item.name}
                </span>
                {item.unitPrice != null && (
                  <span className="text-xs tabular-nums shrink-0">
                    {currency} {(item.quantity * item.unitPrice).toLocaleString()}
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="text-xs italic opacity-70 ml-3">{item.notes}</p>
              )}
            </div>
          ))}
        </div>
      </TableCell>

      {/* Delivery type + address / pickup */}
      <TableCell className="align-top max-w-[240px]">
        <Badge
          variant="secondary"
          className={`text-xs ${
            isDelivery
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          }`}
        >
          {isDelivery ? (
            <MapPin className="h-3 w-3 mr-1" />
          ) : (
            <Store className="h-3 w-3 mr-1" />
          )}
          {isDelivery ? t.orders.delivery : t.orders.pickup}
        </Badge>

        {isDelivery ? (
          <div className="mt-1.5 text-xs text-muted-foreground whitespace-normal break-words">
            {order.deliveryAddress || (
              <span className="italic opacity-70">—</span>
            )}
            {order.neighborhood && (
              <div className="opacity-80">{order.neighborhood}</div>
            )}
            {order.deliveryNotes && (
              <div className="italic opacity-70 mt-0.5">
                {order.deliveryNotes}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1.5 text-xs text-muted-foreground">
            {t.orders.pickupAtStore}
          </div>
        )}

        {missingDeliveryCost && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="h-3 w-3" />
            {t.orders.missingDeliveryCost}
          </div>
        )}
      </TableCell>

      {/* Status */}
      <TableCell className="align-top">
        <Badge
          variant="secondary"
          className={`text-xs font-medium ${config.color}`}
        >
          {statusLabel}
        </Badge>
      </TableCell>

      {/* Total (with breakdown) */}
      <TableCell className="align-top min-w-[160px]">
        {order.estimatedTotal != null ? (
          <div className="space-y-0.5 text-xs tabular-nums">
            {isDelivery && deliveryCost != null && itemsSubtotal != null && (
              <>
                <div className="flex justify-between gap-2 text-muted-foreground font-normal">
                  <span>{t.orders.subtotal}</span>
                  <span>
                    {currency} {itemsSubtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-muted-foreground font-normal">
                  <span>{t.orders.deliveryCost}</span>
                  <span>
                    {currency} {deliveryCost.toLocaleString()}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between gap-2 font-semibold text-sm border-t pt-0.5">
              <span>{t.orders.total}</span>
              <span>
                {currency} {order.estimatedTotal.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <span className="font-semibold">—</span>
        )}
      </TableCell>

      {/* Time */}
      <TableCell className="text-muted-foreground align-top">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(order.createdAt)}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="align-top">
        <div className="flex items-center gap-1.5">
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
          <Link
            href={`/conversations/${order.conversationId}`}
            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 ml-1"
          >
            <MessageSquare className="h-3 w-3" />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}
