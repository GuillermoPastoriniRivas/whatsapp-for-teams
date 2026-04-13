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

  const itemsSummary = order.items
    .map((item) => {
      const base = `${item.quantity}x ${item.name}`;
      return item.notes ? `${base} (${item.notes})` : base;
    })
    .join(", ");

  return (
    <TableRow>
      {/* Contact */}
      <TableCell className="font-medium">
        {order.contactName ?? `#${order.id.slice(-6)}`}
      </TableCell>

      {/* Items */}
      <TableCell className="whitespace-normal text-muted-foreground">
        {itemsSummary}
      </TableCell>

      {/* Delivery type */}
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-xs ${
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
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-xs font-medium ${config.color}`}
        >
          {statusLabel}
        </Badge>
      </TableCell>

      {/* Total */}
      <TableCell className="font-semibold">
        {order.estimatedTotal != null
          ? `${order.currency ?? "$"} ${order.estimatedTotal.toLocaleString()}`
          : "—"}
      </TableCell>

      {/* Time */}
      <TableCell className="text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(order.createdAt)}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell>
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
