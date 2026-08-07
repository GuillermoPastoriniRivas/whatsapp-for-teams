"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { FlowSummary, FlowTemplateDef, FlowConnection, PhoneScopeChoice } from "@/types";

interface FlowState {
  flows: FlowSummary[];
  templates: FlowTemplateDef[];
  connections: FlowConnection[];
  isLoading: boolean;
  fetched: boolean;
  fetch: (force?: boolean) => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  createFlow: (name: string, templateId?: string, scope?: PhoneScopeChoice) => Promise<{ id: string }>;
  archiveFlow: (id: string) => Promise<void>;
  pauseFlow: (id: string) => Promise<void>;
  activateFlow: (id: string) => Promise<void>;
  updatePriority: (id: string, priority: number) => Promise<void>;
  createConnection: (name: string, headerName: string, secret: string) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  flows: [],
  templates: [],
  connections: [],
  isLoading: false,
  fetched: false,

  fetch: async (force = false) => {
    if (get().fetched && !force) return;
    set({ isLoading: true });
    try {
      const flows = await api.get<FlowSummary[]>("/flows");
      set({ flows, isLoading: false, fetched: true });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchTemplates: async () => {
    if (get().templates.length > 0) return;
    try {
      const templates = await api.get<FlowTemplateDef[]>("/flows/templates");
      set({ templates });
    } catch {
      // la galería es opcional
    }
  },

  fetchConnections: async () => {
    try {
      const connections = await api.get<FlowConnection[]>("/flow-connections");
      set({ connections });
    } catch {
      // sin conexiones
    }
  },

  createFlow: async (name, templateId, scope) => {
    const flow = await api.post<{ id: string }>("/flows", {
      name,
      ...(templateId ? { templateId } : {}),
      ...(scope ?? {}),
    });
    await get().fetch(true);
    return flow;
  },

  archiveFlow: async (id) => {
    await api.delete(`/flows/${id}`);
    set((state) => ({ flows: state.flows.filter((f) => f.id !== id) }));
  },

  pauseFlow: async (id) => {
    await api.post(`/flows/${id}/pause`);
    await get().fetch(true);
  },

  activateFlow: async (id) => {
    await api.post(`/flows/${id}/activate`);
    await get().fetch(true);
  },

  updatePriority: async (id, priority) => {
    await api.patch(`/flows/${id}`, { priority });
    await get().fetch(true);
  },

  createConnection: async (name, headerName, secret) => {
    await api.post("/flow-connections", { name, headerName, secret });
    await get().fetchConnections();
  },

  deleteConnection: async (id) => {
    await api.delete(`/flow-connections/${id}`);
    set((state) => ({ connections: state.connections.filter((c) => c.id !== id) }));
  },
}));
