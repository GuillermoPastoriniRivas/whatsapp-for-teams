"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import type { Order, OrderItem } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onCreated?: (order: Order) => void;
}

const emptyItem = (): OrderItem => ({ name: "", quantity: 1 });

export function CreateOrderSheet({
  open,
  onOpenChange,
  conversationId,
  onCreated,
}: Props) {
  const { t } = useTranslations();
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    "delivery"
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [estimatedTotal, setEstimatedTotal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setItems([emptyItem()]);
    setDeliveryType("delivery");
    setDeliveryAddress("");
    setDeliveryNotes("");
    setEstimatedTotal("");
  };

  const handleSubmit = async () => {
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) return;

    setSubmitting(true);
    try {
      const order = await api.post<Order>("/orders", {
        conversationId,
        items: validItems,
        deliveryType,
        deliveryAddress: deliveryAddress || undefined,
        deliveryNotes: deliveryNotes || undefined,
        estimatedTotal: estimatedTotal ? Number(estimatedTotal) : undefined,
      });
      onCreated?.(order);
      reset();
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.orders.createOrder}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Items */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t.orders.items}</label>
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder={t.orders.itemName}
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={t.orders.quantity}
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(i, "quantity", parseInt(e.target.value) || 1)
                      }
                      className="w-20"
                    />
                    <Input
                      type="number"
                      placeholder={t.orders.unitPrice}
                      min={0}
                      value={item.unitPrice ?? ""}
                      onChange={(e) =>
                        updateItem(
                          i,
                          "unitPrice",
                          e.target.value ? Number(e.target.value) : 0
                        )
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground"
                    onClick={() => removeItem(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t.orders.addItem}
            </Button>
          </div>

          {/* Delivery type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t.orders.deliveryType}
            </label>
            <div className="flex gap-2">
              <Button
                variant={deliveryType === "delivery" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeliveryType("delivery")}
              >
                {t.orders.delivery}
              </Button>
              <Button
                variant={deliveryType === "pickup" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeliveryType("pickup")}
              >
                {t.orders.pickup}
              </Button>
            </div>
          </div>

          {/* Address (only for delivery) */}
          {deliveryType === "delivery" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.orders.deliveryAddress}
              </label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t.orders.address}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.orders.notes}</label>
            <Textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder={t.orders.deliveryNotes}
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t.orders.estimatedTotal}
            </label>
            <Input
              type="number"
              min={0}
              value={estimatedTotal}
              onChange={(e) => setEstimatedTotal(e.target.value)}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t.orders.cancel}
            </Button>
            <Button
              className="flex-1"
              disabled={submitting || items.every((i) => !i.name.trim())}
              onClick={handleSubmit}
            >
              {submitting ? "..." : t.orders.create}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
