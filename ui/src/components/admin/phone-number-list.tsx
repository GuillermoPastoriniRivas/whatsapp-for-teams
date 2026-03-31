"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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
            className="gap-1.5 bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Number
          </Button>
        </div>
      </div>

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
                  selectedId === phone.id && "bg-primary/5"
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
                  <Badge
                    variant={phone.status === "active" ? "default" : "secondary"}
                    className="capitalize text-[10px] h-5"
                  >
                    {phone.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
