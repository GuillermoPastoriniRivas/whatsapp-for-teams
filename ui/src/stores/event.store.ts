"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { ConversationEvent } from "@/types";

interface EventState {
  events: Record<string, ConversationEvent[]>;
  fetch: (conversationId: string) => Promise<void>;
  appendEvent: (conversationId: string, event: ConversationEvent) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: {},

  fetch: async (conversationId) => {
    try {
      const data = await api.get<ConversationEvent[]>(
        `/conversations/${conversationId}/events`
      );
      set((state) => ({
        events: {
          ...state.events,
          [conversationId]: data,
        },
      }));
    } catch {
      // silent — events are non-critical
    }
  },

  appendEvent: (conversationId, event) => {
    set((state) => {
      const existing = state.events[conversationId] || [];
      if (existing.some((e) => e.id === event.id)) return state;
      return {
        events: {
          ...state.events,
          [conversationId]: [...existing, event],
        },
      };
    });
  },
}));
