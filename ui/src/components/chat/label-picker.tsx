"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useLabelStore } from "@/stores/label.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LabelBadge } from "./label-badge";
import { LABEL_COLORS } from "@/lib/label-colors";
import { getSocket } from "@/lib/socket";
import type { ConversationLabelEntry } from "@/types";

interface Props {
  conversationId: string;
}

export function LabelPicker({ conversationId }: Props) {
  const [assigned, setAssigned] = useState<ConversationLabelEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { labels, fetch: fetchLabels } = useLabelStore();
  const { t } = useTranslations();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLabels();
    api
      .get<ConversationLabelEntry[]>(`/conversations/${conversationId}/labels`)
      .then(setAssigned)
      .catch(() => setAssigned([]));
  }, [conversationId]);

  // Real-time listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAssigned = (data: any) => {
      if (data.conversationId !== conversationId) return;
      const label = data.label;
      setAssigned((prev) => {
        if (prev.some((a) => a.labelId === label.id)) return prev;
        return [
          ...prev,
          {
            id: "",
            labelId: label.id,
            labelName: label.name,
            labelColor: label.color,
            assignedBy: "",
            createdAt: new Date().toISOString(),
          },
        ];
      });
    };

    const onRemoved = (data: any) => {
      if (data.conversationId !== conversationId) return;
      setAssigned((prev) => prev.filter((a) => a.labelId !== data.labelId));
    };

    socket.on("label.assigned", onAssigned);
    socket.on("label.removed", onRemoved);
    return () => {
      socket.off("label.assigned", onAssigned);
      socket.off("label.removed", onRemoved);
    };
  }, [conversationId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const assignedIds = new Set(assigned.map((a) => a.labelId));
  const available = labels.filter(
    (l) =>
      !assignedIds.has(l.id) &&
      l.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAssign(labelId: string) {
    const label = labels.find((l) => l.id === labelId);
    if (!label) return;
    // Optimistic update — guard against duplicates from socket
    setAssigned((prev) =>
      prev.some((a) => a.labelId === labelId)
        ? prev
        : [
            ...prev,
            {
              id: "",
              labelId: label.id,
              labelName: label.name,
              labelColor: label.color,
              assignedBy: "",
              createdAt: new Date().toISOString(),
            },
          ]
    );
    setSearch("");
    try {
      await api.post(`/conversations/${conversationId}/labels`, { labelId });
    } catch {
      // Rollback on error
      setAssigned((prev) => prev.filter((a) => a.labelId !== labelId));
    }
  }

  async function handleRemove(labelId: string) {
    const removed = assigned.find((a) => a.labelId === labelId);
    // Optimistic update
    setAssigned((prev) => prev.filter((a) => a.labelId !== labelId));
    try {
      await api.delete(`/conversations/${conversationId}/labels/${labelId}`);
    } catch {
      // Rollback on error
      if (removed) setAssigned((prev) => [...prev, removed]);
    }
  }

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      {/* Assigned labels */}
      <div className="flex flex-wrap gap-1.5">
        {assigned.map((a) => (
          <LabelBadge
            key={a.labelId}
            name={a.labelName}
            color={a.labelColor}
            onRemove={() => handleRemove(a.labelId)}
          />
        ))}
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-muted-foreground/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t.contactPanel.addLabel}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="rounded-lg border bg-popover shadow-md p-1 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.contactPanel.searchLabels}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-36 overflow-y-auto">
            {available.length === 0 ? (
              <p className="px-2 py-3 text-xs text-center text-muted-foreground">
                {t.contactPanel.noLabels}
              </p>
            ) : (
              available.map((label) => {
                const c = LABEL_COLORS[label.color] ?? LABEL_COLORS.gray;
                return (
                  <button
                    key={label.id}
                    onClick={() => handleAssign(label.id)}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.fg }}
                    />
                    {label.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
