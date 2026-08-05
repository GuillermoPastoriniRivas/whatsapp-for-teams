"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, AtSign, Clock, StickyNote, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { displayIdentity, identityHandle, identitySubtitle, formatPhone } from "@/lib/identity";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ActivityTimeline } from "./activity-timeline";
import { ConversationNotes } from "./conversation-notes";
import { ContactFields } from "./contact-fields";
import { LabelPicker } from "./label-picker";
import type { Conversation, ConversationEvent } from "@/types";

interface Props {
  conversation: Conversation | undefined;
}

export function ContactInfoPanel({ conversation }: Props) {
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslations();

  useEffect(() => {
    if (!conversation) return;
    setLoading(true);
    api
      .get<ConversationEvent[]>(`/conversations/${conversation.id}/events`)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [conversation?.id]);

  const contact = conversation?.contact;

  return (
    <>
      <div className="bg-[var(--asis-surface-header)] pt-8 pb-6 flex flex-col items-center">
        <Avatar className="mb-3 size-20">
          <AvatarFallback>
            <User className="size-10" />
          </AvatarFallback>
        </Avatar>
        <h2 className="text-lg font-semibold text-center px-4">
          {displayIdentity(contact, t.chat.unknown)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {identitySubtitle(contact)}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Contact details */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {t.contactPanel.contactInfo}
          </h3>
          <div className="flex items-center gap-3 text-sm">
            {contact?.phone ? (
              <>
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatPhone(contact.phone)}</span>
              </>
            ) : (
              // Sin teléfono el contacto igual es alcanzable por su BSUID; se
              // muestra el username para que el agente sepa con quién habla.
              <>
                <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{identityHandle(contact ?? {}) ?? "—"}</span>
              </>
            )}
          </div>
          {contact?.id && (
            <ContactFields
              contact={{
                id: contact.id,
                email: contact.email ?? null,
                company: contact.company ?? null,
                notes: contact.notes ?? null,
                customFields: contact.customFields ?? {},
              }}
              onUpdated={() => {}}
            />
          )}
        </div>

        <Separator />

        {/* Agent assignment */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {t.contactPanel.assignment}
          </h3>
          <div className="flex items-center gap-2">
            {conversation?.agentName ? (
              <Badge variant="secondary" className="gap-1">
                <User className="h-3 w-3" />
                {conversation.agentName}
              </Badge>
            ) : (
              <Badge variant="destructive">{t.contactPanel.unassigned}</Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {conversation?.status}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Labels */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {t.contactPanel.labels}
          </h3>
          {conversation && <LabelPicker conversationId={conversation.id} />}
        </div>

        <Separator />

        {/* Internal notes */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            {t.contactPanel.internalNotes}
          </h3>
          {conversation && (
            <ConversationNotes conversationId={conversation.id} open={true} />
          )}
        </div>

        <Separator />

        {/* Activity timeline */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t.contactPanel.activity}
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t.contactPanel.loading}</p>
          ) : (
            <ActivityTimeline events={events} />
          )}
        </div>
      </div>
    </>
  );
}
