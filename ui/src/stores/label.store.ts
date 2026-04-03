"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { Label } from "@/types";

interface LabelState {
  labels: Label[];
  isLoading: boolean;
  fetched: boolean;
  fetch: (force?: boolean) => Promise<void>;
  createLabel: (name: string, color: string) => Promise<Label>;
  updateLabel: (id: string, data: { name?: string; color?: string }) => Promise<Label>;
  deleteLabel: (id: string) => Promise<void>;
}

export const useLabelStore = create<LabelState>((set, get) => ({
  labels: [],
  isLoading: false,
  fetched: false,

  fetch: async (force = false) => {
    if (get().fetched && !force) return;
    set({ isLoading: true });
    try {
      const labels = await api.get<Label[]>("/labels");
      set({ labels, isLoading: false, fetched: true });
    } catch {
      set({ isLoading: false });
    }
  },

  createLabel: async (name, color) => {
    const label = await api.post<Label>("/labels", { name, color });
    set((state) => ({ labels: [...state.labels, label] }));
    return label;
  },

  updateLabel: async (id, data) => {
    const updated = await api.patch<Label>(`/labels/${id}`, data);
    set((state) => ({
      labels: state.labels.map((l) => (l.id === id ? updated : l)),
    }));
    return updated;
  },

  deleteLabel: async (id) => {
    await api.delete(`/labels/${id}`);
    set((state) => ({
      labels: state.labels.filter((l) => l.id !== id),
    }));
  },
}));
