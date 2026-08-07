"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Phone, Snowflake } from "lucide-react";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { InlineNotice } from "@/components/shared/inline-notice";
import { cn } from "@/lib/utils";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { RegisterPhonePanel } from "./register-phone-panel";
import { EditPhonePanel } from "./edit-phone-panel";
import type { PhoneNumber } from "@/types";

interface Props {
  onPanelChange: (content: ReactNode) => void;
  onPanelClose: () => void;
  /** Ver `AgentList`: la cabecera de la página dispara el alta desde acá. */
  createRef?: RefObject<(() => void) | null>;
}

export function PhoneNumberList({ onPanelChange, onPanelClose, createRef }: Props) {
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

  useEffect(() => {
    if (createRef) createRef.current = openCreate;
  });

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3">
      {atLimit && phoneUsage && (
        <InlineNotice variant="warning">
          {t.billing.limitReached} ({phoneUsage.current}/{phoneUsage.limit}). {t.billing.upgradeToAdd}
        </InlineNotice>
      )}

      {phones.length === 0 ? (
        <EmptyState icon={Phone} title={t.admin.noPhones} description={t.admin.noPhonesHint} />
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {phones.map((phone) => (
            // Fila con rol de botón: adentro hay otro botón real ("Activar").
            <div
              key={phone.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail(phone)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetail(phone);
                }
              }}
              className={cn(
                "flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                selectedId === phone.id && "bg-primary/5",
                phone.status === "inactive" && "opacity-50"
              )}
            >
              {/* La foto del perfil de WhatsApp cuando el número la tiene:
                  es la que ve el cliente, así que identifica mejor que el ícono. */}
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                {phone.businessProfile?.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={phone.businessProfile.profilePictureUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Phone className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{phone.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {phone.displayPhone}
                  {phone.businessProfile?.about ? ` · ${phone.businessProfile.about}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {phone.provider}
                </Badge>
                {phone.status === "inactive" ? (
                  <>
                    <StatusPill tone="warning">
                      <Snowflake className="size-3" />
                      {t.billing.frozen}
                    </StatusPill>
                    <Button size="sm" variant="ghost" onClick={(e) => handleToggle(phone, e)}>
                      {t.billing.activate}
                    </Button>
                  </>
                ) : (
                  <StatusPill tone="success">{t.admin.statusActive}</StatusPill>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
