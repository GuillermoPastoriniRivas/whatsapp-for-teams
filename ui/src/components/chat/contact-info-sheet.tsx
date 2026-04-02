"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Clock, StickyNote } from "lucide-react";
import { api } from "@/lib/api";
import { ActivityTimeline } from "./activity-timeline";
import { ConversationNotes } from "./conversation-notes";
import { ContactFields } from "./contact-fields";
import type { Conversation, ConversationEvent } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | undefined;
}

export function ContactInfoSheet({ open, onOpenChange, conversation }: Props) {
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !conversation) return;
    setLoading(true);
    api
      .get<ConversationEvent[]>(
        `/conversations/${conversation.id}/events`
      )
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [open, conversation?.id]);

  const contact = conversation?.contact;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 overflow-y-auto">
        <div className="bg-[var(--asis-surface-header)] pt-14 pb-6 flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 mb-3">
            <User className="h-10 w-10" />
          </div>
          <SheetHeader className="text-center px-4">
            <SheetTitle className="text-lg">
              {contact?.name || "Unknown"}
            </SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-1">
            +{contact?.waId || contact?.phone || "—"}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Contact details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Contact Info
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
                onUpdated={() => {
                  // Fields update in-place via the component's own state
                }}
              />
            )}
          </div>

          <Separator />

          {/* Agent assignment */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Assignment
            </h3>
            <div className="flex items-center gap-2">
              {conversation?.agentName ? (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {conversation.agentName}
                </Badge>
              ) : (
                <Badge variant="destructive">Unassigned</Badge>
              )}
              <Badge
                variant="outline"
                className="capitalize"
              >
                {conversation?.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Internal notes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              Internal Notes
            </h3>
            {conversation && (
              <ConversationNotes
                conversationId={conversation.id}
                open={open}
              />
            )}
          </div>

          <Separator />

          {/* Activity timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Activity
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <ActivityTimeline events={events} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
