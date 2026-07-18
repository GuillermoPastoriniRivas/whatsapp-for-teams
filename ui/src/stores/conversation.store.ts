"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { Conversation, PaginatedResponse } from "@/types";

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  total: number;
  page: number;
  pages: number;
  statusFilter: string;
  view: "inbox" | "campaign";
  isLoading: boolean;
  unreadCounts: Record<string, number>;
  fetch: (status?: string, page?: number) => Promise<void>;
  setActive: (id: string | null) => void;
  setFilter: (status: string) => void;
  setView: (view: "inbox" | "campaign") => void;
  updateConversation: (conv: Partial<Conversation> & { id: string }) => void;
  addConversation: (conv: Conversation) => void;
  incrementUnread: (convId: string) => void;
  clearUnread: (convId: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeId: null,
  total: 0,
  page: 1,
  pages: 1,
  statusFilter: "",
  view: "inbox",
  isLoading: false,
  unreadCounts: {},

  fetch: async (status?: string, page = 1) => {
    set({ isLoading: true });
    try {
      const filter = status ?? get().statusFilter;
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      // "unread" es un filtro propio, no un status del backend
      if (filter === "unread") params.set("unread", "true");
      else if (filter) params.set("status", filter);
      // Default 'inbox' sends no param — server behavior stays untouched
      if (get().view === "campaign") params.set("view", "campaign");

      const data = await api.get<PaginatedResponse<Conversation>>(
        `/conversations?${params}`
      );

      // El servidor es la fuente de verdad de los no leídos; la conversación
      // abierta se mantiene en 0 (el mark-read puede estar en vuelo)
      const activeId = get().activeId;
      const unreadCounts = { ...get().unreadCounts };
      for (const conv of data.data) {
        unreadCounts[conv.id] = conv.id === activeId ? 0 : (conv.unreadCount ?? 0);
      }

      set({
        conversations: data.data,
        total: data.meta.total,
        page: data.meta.page,
        pages: data.meta.pages,
        unreadCounts,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setActive: (id) => set({ activeId: id }),

  setFilter: (status) => {
    set({ statusFilter: status });
    get().fetch(status);
  },

  setView: (view) => {
    set({ view });
    get().fetch();
  },

  updateConversation: (conv) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conv.id ? { ...c, ...conv } : c
      ),
    }));
  },

  addConversation: (conv) => {
    set((state) => ({
      conversations: [conv, ...state.conversations],
    }));
  },

  incrementUnread: (convId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [convId]: (state.unreadCounts[convId] || 0) + 1,
      },
    }));
  },

  clearUnread: (convId) => {
    set((state) => {
      const { [convId]: _, ...rest } = state.unreadCounts;
      return { unreadCounts: rest };
    });
    // Siempre persistir: el contador local puede estar en 0 aunque el del
    // servidor no (p. ej. mensaje entrante con el chat abierto)
    api.post(`/conversations/${convId}/read`).catch(() => {});
  },
}));
