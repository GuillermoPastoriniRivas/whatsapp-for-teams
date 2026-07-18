"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  Campaign,
  CampaignAudience,
  CampaignCounts,
  CampaignStatus,
  PaginatedResponse,
  VariableMapping,
} from "@/types";

export interface CampaignProgressEvent {
  campaignId: string;
  counts?: Partial<CampaignCounts>;
  status?: CampaignStatus;
  replied?: number;
  failureReason?: string;
}

export interface CampaignPayload {
  name: string;
  phoneNumberId: string;
  templateId: string;
  variableMappings: VariableMapping[];
  audience: CampaignAudience;
  scheduledAt?: string;
  replyWindowHours?: number;
}

interface CampaignState {
  campaigns: Campaign[];
  meta: { total: number; page: number; pages: number };
  statusFilter: CampaignStatus | "";
  isLoading: boolean;
  fetch: (page?: number) => Promise<void>;
  setStatusFilter: (status: CampaignStatus | "") => void;
  create: (payload: CampaignPayload) => Promise<Campaign>;
  updateDraft: (id: string, payload: Partial<CampaignPayload>) => Promise<Campaign>;
  start: (id: string) => Promise<Campaign>;
  pause: (id: string) => Promise<Campaign>;
  resume: (id: string) => Promise<Campaign>;
  cancel: (id: string) => Promise<Campaign>;
  remove: (id: string) => Promise<void>;
  applyProgress: (event: CampaignProgressEvent) => void;
}

export const useCampaignStore = create<CampaignState>((set, get) => {
  const transition = async (id: string, action: "start" | "pause" | "resume" | "cancel"): Promise<Campaign> => {
    const updated = await api.post<Campaign>(`/campaigns/${id}/${action}`);
    set((state) => ({ campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)) }));
    return updated;
  };

  return {
    campaigns: [],
    meta: { total: 0, page: 1, pages: 1 },
    statusFilter: "",
    isLoading: false,

    fetch: async (page = 1) => {
      set({ isLoading: true });
      try {
        const params = new URLSearchParams({ page: String(page), limit: "30" });
        if (get().statusFilter) params.set("status", get().statusFilter);
        const res = await api.get<PaginatedResponse<Campaign>>(`/campaigns?${params}`);
        set({ campaigns: res.data, meta: res.meta, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    setStatusFilter: (statusFilter) => {
      set({ statusFilter });
      get().fetch(1);
    },

    create: async (payload) => {
      const campaign = await api.post<Campaign>("/campaigns", payload);
      set((state) => ({ campaigns: [campaign, ...state.campaigns] }));
      return campaign;
    },

    updateDraft: async (id, payload) => {
      const updated = await api.patch<Campaign>(`/campaigns/${id}`, payload);
      set((state) => ({ campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)) }));
      return updated;
    },

    start: (id) => transition(id, "start"),
    pause: (id) => transition(id, "pause"),
    resume: (id) => transition(id, "resume"),
    cancel: (id) => transition(id, "cancel"),

    remove: async (id) => {
      await api.delete(`/campaigns/${id}`);
      set((state) => ({ campaigns: state.campaigns.filter((c) => c.id !== id) }));
    },

    applyProgress: (event) => {
      set((state) => ({
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === event.campaignId
            ? {
                ...campaign,
                ...(event.status ? { status: event.status } : {}),
                ...(event.failureReason !== undefined ? { failureReason: event.failureReason } : {}),
                counts: {
                  ...campaign.counts,
                  ...(event.counts ?? {}),
                  ...(event.replied !== undefined ? { replied: event.replied } : {}),
                },
              }
            : campaign
        ),
      }));
    },
  };
});
