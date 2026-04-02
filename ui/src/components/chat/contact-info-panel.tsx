"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Clock, StickyNote } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ActivityTimeline } from "./activity-timeline";
import { ConversationNotes } from "./conversation-notes";
import { ContactFields } from "./contact-fields";
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
        <div className="h-20 w-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 mb-3">
          <User className="h-10 w-10" />
        </div>
        <h2 className="text-lg font-semibold text-center px-4">
          {contact?.name || t.chat.unknown}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          +{contact?.waId || contact?.phone || "—"}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Contact details */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {t.contactPanel.contactInfo}
          </h3>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>+{contact?.waId || contact?.phone || "—"}</span>
          </div>
          {contact?.id && (
            <ContactFields
              contact={{
                id: contact.id,
                email: contact.email ?? null,
                company: contact.company ?? null,
                notes: contact.notes ?? null,
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
