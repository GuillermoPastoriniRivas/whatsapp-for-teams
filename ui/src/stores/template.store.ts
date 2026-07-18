"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  MessageTemplate,
  PaginatedResponse,
  TemplateCategory,
  TemplateComponent,
  TemplateQuality,
  TemplateStatus,
} from "@/types";

export interface TemplateRealtimeEvent {
  templateId: string;
  status?: TemplateStatus;
  qualityScore?: TemplateQuality;
  reason?: string | null;
}

export interface CreateTemplatePayload {
  phoneNumberId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: TemplateComponent[];
}

interface TemplateState {
  templates: MessageTemplate[];
  meta: { total: number; page: number; pages: number };
  statusFilter: TemplateStatus | "";
  phoneNumberId: string;
  search: string;
  isLoading: boolean;
  fetch: (page?: number) => Promise<void>;
  setStatusFilter: (status: TemplateStatus | "") => void;
  setPhoneNumberId: (id: string) => void;
  setSearch: (search: string) => void;
  create: (payload: CreateTemplatePayload) => Promise<MessageTemplate>;
  update: (
    id: string,
    data: { category?: TemplateCategory; components?: TemplateComponent[] }
  ) => Promise<MessageTemplate>;
  remove: (id: string) => Promise<void>;
  sync: (phoneNumberId: string) => Promise<number>;
  applyRealtime: (event: TemplateRealtimeEvent) => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  meta: { total: 0, page: 1, pages: 1 },
  statusFilter: "",
  phoneNumberId: "",
  search: "",
  isLoading: false,

  fetch: async (page = 1) => {
    set({ isLoading: true });
    try {
      const { statusFilter, phoneNumberId, search } = get();
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (statusFilter) params.set("status", statusFilter);
      if (phoneNumberId) params.set("phoneNumberId", phoneNumberId);
      if (search) params.set("search", search);
      const res = await api.get<PaginatedResponse<MessageTemplate>>(`/templates?${params}`);
      set({ templates: res.data, meta: res.meta, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter });
    get().fetch(1);
  },

  setPhoneNumberId: (phoneNumberId) => {
    set({ phoneNumberId });
    get().fetch(1);
  },

  setSearch: (search) => {
    set({ search });
    get().fetch(1);
  },

  create: async (payload) => {
    const template = await api.post<MessageTemplate>("/templates", payload);
    set((state) => ({ templates: [template, ...state.templates] }));
    return template;
  },

  update: async (id, data) => {
    const updated = await api.patch<MessageTemplate>(`/templates/${id}`, data);
    set((state) => ({
      templates: state.templates.map((tpl) => (tpl.id === id ? updated : tpl)),
    }));
    return updated;
  },

  remove: async (id) => {
    await api.delete(`/templates/${id}`);
    set((state) => ({ templates: state.templates.filter((tpl) => tpl.id !== id) }));
  },

  sync: async (phoneNumberId) => {
    const result = await api.post<{ synced: number }>("/templates/sync", { phoneNumberId });
    await get().fetch(get().meta.page);
    return result.synced;
  },

  applyRealtime: (event) => {
    set((state) => ({
      templates: state.templates.map((tpl) =>
        tpl.id === event.templateId
          ? {
              ...tpl,
              ...(event.status ? { status: event.status } : {}),
              ...(event.qualityScore ? { qualityScore: event.qualityScore } : {}),
              ...(event.reason !== undefined ? { rejectionReason: event.reason } : {}),
            }
          : tpl
      ),
    }));
  },
}));
