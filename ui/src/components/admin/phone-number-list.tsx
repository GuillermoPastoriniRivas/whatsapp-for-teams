"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Plus, Pencil } from "lucide-react";
import { RegisterPhoneForm } from "./register-phone-form";
import { EditPhoneForm } from "./edit-phone-form";
import type { PhoneNumber } from "@/types";

export function PhoneNumberList() {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editPhone, setEditPhone] = useState<PhoneNumber | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Phone Numbers</h2>
        <Button size="sm" onClick={() => setRegisterOpen(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Number
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : phones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No phone numbers registered</p>
      ) : (
        <div className="space-y-2">
          {phones.map((phone) => (
            <div
              key={phone.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{phone.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {phone.displayPhone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {phone.provider}
                </Badge>
                <Badge
                  variant={phone.status === "active" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {phone.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditPhone(phone)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RegisterPhoneForm
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={fetchPhones}
      />

      <EditPhoneForm
        phone={editPhone}
        open={!!editPhone}
        onOpenChange={(open) => { if (!open) setEditPhone(null); }}
        onUpdated={fetchPhones}
      />
    </div>
  );
}
