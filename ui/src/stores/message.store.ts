"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { Message, PaginatedResponse } from "@/types";

interface MessageState {
  messages: Record<string, Message[]>;
  isLoading: boolean;
  /**
   * Mensaje que se está citando al responder. Vive en el store y no en el
   * input porque lo elige la burbuja y lo consume el compositor.
   */
  replyTo: Message | null;
  setReplyTo: (message: Message | null) => void;
  fetch: (conversationId: string, page?: number) => Promise<void>;
  appendMessage: (conversationId: string, message: Message) => void;
  updateStatus: (waMessageId: string, waStatus: string) => void;
  send: (
    conversationId: string,
    body: string,
    mediaAssetId?: string
  ) => Promise<Message | undefined>;
  /** Reacciona con un emoji a un mensaje. Vacío quita la reacción. */
  react: (conversationId: string, messageId: string, emoji: string) => Promise<void>;
  /** Un archivo terminó de bajarse: se refresca el mensaje que lo lleva. */
  applyMediaUpdate: (assetId: string) => Promise<void>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  isLoading: false,
  replyTo: null,

  setReplyTo: (message) => set({ replyTo: message }),

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

  applyMediaUpdate: async (assetId) => {
    const state = get();
    const target = Object.entries(state.messages).find(([, list]) =>
      list.some((message) => message.media?.id === assetId || message.mediaAssetId === assetId)
    );
    if (!target) return;

    const [conversationId] = target;
    try {
      const media = await api.get<Message["media"]>(`/media/${assetId}`);
      set((current) => ({
        messages: {
          ...current.messages,
          [conversationId]: (current.messages[conversationId] ?? []).map((message) =>
            message.media?.id === assetId || message.mediaAssetId === assetId
              ? { ...message, media }
              : message
          ),
        },
      }));
    } catch {
      // si el archivo desapareció, el próximo fetch lo refleja
    }
  },

  react: async (conversationId, messageId, emoji) => {
    const message = await api.post<Message>(
      `/conversations/${conversationId}/messages/${messageId}/reaction`,
      { emoji }
    );
    get().appendMessage(conversationId, message);
  },

  send: async (conversationId, body, mediaAssetId) => {
    const replyToMessageId = get().replyTo?.id;
    const message = await api.post<Message>(
      `/conversations/${conversationId}/messages`,
      {
        body,
        ...(mediaAssetId ? { mediaAssetId } : {}),
        ...(replyToMessageId ? { replyToMessageId } : {}),
      }
    );
    // La cita se consume con el envío: dejarla puesta haría que el siguiente
    // mensaje cite lo mismo sin que el agente lo haya pedido.
    set({ replyTo: null });
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
