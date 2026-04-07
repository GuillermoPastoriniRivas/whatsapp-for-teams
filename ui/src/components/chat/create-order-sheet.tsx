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

        <div className="mt-6 space-y-6">
          {/* Items */}
          <section>
            <label className="text-sm font-semibold text-foreground mb-3 block">
              {t.orders.items}
            </label>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={t.orders.itemName}
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                      className="flex-1 bg-background"
                    />
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="w-20">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {t.orders.quantity}
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(i, "quantity", parseInt(e.target.value) || 1)
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {t.orders.unitPrice}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={item.unitPrice ?? ""}
                        onChange={(e) =>
                          updateItem(
                            i,
                            "unitPrice",
                            e.target.value ? Number(e.target.value) : 0
                          )
                        }
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t.orders.addItem}
            </Button>
          </section>

          <div className="border-t" />

          {/* Delivery type */}
          <section className="space-y-3">
            <label className="text-sm font-semibold text-foreground block">
              {t.orders.deliveryType}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={deliveryType === "delivery" ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setDeliveryType("delivery")}
              >
                {t.orders.delivery}
              </Button>
              <Button
                variant={deliveryType === "pickup" ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setDeliveryType("pickup")}
              >
                {t.orders.pickup}
              </Button>
            </div>

            {/* Address (only for delivery) */}
            {deliveryType === "delivery" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
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
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {t.orders.notes}
              </label>
              <Textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder={t.orders.deliveryNotes}
                rows={2}
              />
            </div>
          </section>

          <div className="border-t" />

          {/* Total */}
          <section className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground block">
              {t.orders.estimatedTotal}
            </label>
            <Input
              type="number"
              min={0}
              value={estimatedTotal}
              onChange={(e) => setEstimatedTotal(e.target.value)}
              placeholder="0.00"
            />
          </section>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t">
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
