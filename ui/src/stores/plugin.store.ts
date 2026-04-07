"use client";

import { create } from "zustand";
import { api } from "@/lib/api";

interface PluginState {
  plugins: string[];
  loaded: boolean;
  load: () => Promise<void>;
  has: (plugin: string) => boolean;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const data = await api.get<{ plugins: string[] }>(
        "/phone-numbers/active-plugins"
      );
      set({ plugins: data.plugins, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  has: (plugin) => get().plugins.includes(plugin),
}));
