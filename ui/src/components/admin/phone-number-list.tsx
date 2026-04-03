"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Plus, AlertTriangle, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { RegisterPhonePanel } from "./register-phone-panel";
import { EditPhonePanel } from "./edit-phone-panel";
import type { PhoneNumber } from "@/types";

interface Props {
  onPanelChange: (content: ReactNode) => void;
  onPanelClose: () => void;
}

export function PhoneNumberList({ onPanelChange, onPanelClose }: Props) {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { usage, fetchUsage, toggleResource } = useBillingStore();
  const { t } = useTranslations();
  const phoneUsage = usage?.phoneNumbers;
  const atLimit = phoneUsage ? !phoneUsage.allowed : false;

  const handleToggle = async (phone: PhoneNumber, e: React.MouseEvent) => {
    e.stopPropagation();
    if (phone.status === "inactive") {
      // Find an active phone to swap with if at limit
      const activePhones = phones.filter(p => p.status === "active");
      const deactivateId = atLimit && activePhones.length > 0 ? activePhones[activePhones.length - 1].id : undefined;
      await toggleResource("phone_numbers", phone.id, deactivateId);
    } else {
      await toggleResource("phone_numbers", phones.find(p => p.status === "inactive")?.id ?? phone.id, phone.id);
    }
    fetchPhones();
    fetchUsage();
  };

  const fetchPhones = () => {
    setLoading(true);
    api
      .get<PhoneNumber[]>("/phone-numbers")
      .then(setPhones)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPhones();
    fetchUsage();
  }, []);

  const closePanel = () => {
    setSelectedId(null);
    onPanelClose();
  };

  const openCreate = () => {
    setSelectedId("__create__");
    onPanelChange(
      <RegisterPhonePanel
        onCreated={() => {
          fetchPhones();
          closePanel();
        }}
        onCancel={closePanel}
      />
    );
  };

  const openDetail = (phone: PhoneNumber) => {
    setSelectedId(phone.id);
    onPanelChange(
      <EditPhonePanel
        phone={phone}
        onUpdated={fetchPhones}
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 md:px-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Phone Numbers</h2>
          <Button
            size="sm"
            onClick={openCreate}
            disabled={atLimit}
            className="gap-1.5 bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Number
          </Button>
        </div>
      </div>

      {atLimit && (
        <div className="mx-4 mt-2 md:mx-6 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Plan limit reached ({phoneUsage!.current}/{phoneUsage!.limit}). Upgrade to add more.</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {loading ? (
          <p className="text-sm text-muted-foreground p-4 md:p-6">Loading...</p>
        ) : phones.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center m-4 md:m-6">
            <Phone className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No phone numbers registered yet.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {phones.map((phone) => (
              <button
                key={phone.id}
                type="button"
                onClick={() => openDetail(phone)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 md:px-6 text-left hover:bg-muted/50 transition-colors",
                  selectedId === phone.id && "bg-primary/5",
                  phone.status === "inactive" && "opacity-50"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{phone.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {phone.displayPhone}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="capitalize text-[10px] h-5">
                    {phone.provider}
                  </Badge>
                  {phone.status === "inactive" ? (
                    <>
                      <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200 gap-1">
                        <Snowflake className="h-3 w-3" />
                        {t.billing.frozen}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-primary" onClick={(e) => handleToggle(phone, e)}>
                        {t.billing.activate}
                      </Button>
                    </>
                  ) : (
                    <Badge
                      variant="default"
                      className="capitalize text-[10px] h-5"
                    >
                      {phone.status}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
