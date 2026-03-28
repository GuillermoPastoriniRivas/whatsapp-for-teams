"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ConversationNote } from "@/types";

function formatNoteTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  conversationId: string;
  open: boolean;
}

export function ConversationNotes({ conversationId, open }: Props) {
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !conversationId) return;
    setLoading(true);
    api
      .get<ConversationNote[]>(`/conversations/${conversationId}/notes`)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [open, conversationId]);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const note = await api.post<ConversationNote>(
        `/conversations/${conversationId}/notes`,
        { body: trimmed }
      );
      setNotes((prev) => [...prev, note]);
      setBody("");
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading notes...</p>;
  }

  return (
    <div className="space-y-3">
      {notes.length === 0 && (
        <p className="text-sm text-muted-foreground py-2 text-center">
          No notes yet. Add one for your team.
        </p>
      )}

      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 p-3"
        >
          <p className="text-sm whitespace-pre-wrap">{note.body}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            <span className="font-medium">{note.authorName}</span>
            <span>·</span>
            <span>{formatNoteTime(note.createdAt)}</span>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Textarea
          placeholder="Add an internal note..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSubmit}
          disabled={!body.trim() || sending}
          className="shrink-0 self-end"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
