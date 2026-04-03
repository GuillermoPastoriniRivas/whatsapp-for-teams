"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { Message, PaginatedResponse } from "@/types";

interface MessageState {
  messages: Record<string, Message[]>;
  isLoading: boolean;
  fetch: (conversationId: string, page?: number) => Promise<void>;
  appendMessage: (conversationId: string, message: Message) => void;
  updateStatus: (waMessageId: string, waStatus: string) => void;
  send: (
    conversationId: string,
    body: string
  ) => Promise<Message | undefined>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  isLoading: false,

  fetch: async (conversationId, page = 1) => {
    set({ isLoading: true });
    try {
      const data = await api.get<PaginatedResponse<Message>>(
        `/conversations/${conversationId}/messages?page=${page}&limit=50`
      );
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: data.data,
        },
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  appendMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.messages[conversationId] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existing, message],
        },
      };
    });
  },

  updateStatus: (waMessageId, waStatus) => {
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId in newMessages) {
        newMessages[convId] = newMessages[convId].map((m) =>
          m.waMessageId === waMessageId
            ? { ...m, waStatus: waStatus as Message["waStatus"] }
            : m
        );
      }
      return { messages: newMessages };
    });
  },

  send: async (conversationId, body) => {
    const message = await api.post<Message>(
      `/conversations/${conversationId}/messages`,
      { body }
    );
    get().appendMessage(conversationId, message);

    // Trigger mock AI reply in demo mode
    try {
      const stored = localStorage.getItem("agent");
      const agent = stored ? JSON.parse(stored) : null;
      if (agent?.email === "demo@asis.chat") {
        api.post(`/conversations/${conversationId}/demo-ai-reply`).catch(() => {});
      }
    } catch {
      // ignore
    }

    return message;
  },
}));
