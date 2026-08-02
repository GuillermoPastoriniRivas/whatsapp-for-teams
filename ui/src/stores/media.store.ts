"use client";

import { create } from "zustand";
import { api, ApiError } from "@/lib/api";
import type { MediaAsset, MediaKind, MediaUsage, PaginatedResponse } from "@/types";

export type MediaScope = "library" | "history" | "all";

export interface MediaFilters {
  scope: MediaScope;
  kinds: MediaKind[];
  search: string;
  tags: string[];
}

interface MediaState {
  assets: MediaAsset[];
  usage: MediaUsage | null;
  tags: string[];
  filters: MediaFilters;
  page: number;
  pages: number;
  total: number;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;

  setFilters: (filters: Partial<MediaFilters>) => void;
  fetch: (page?: number) => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchTags: () => Promise<void>;
  upload: (file: File, options?: UploadOptions) => Promise<MediaAsset>;
  update: (id: string, patch: Partial<Pick<MediaAsset, "inLibrary" | "title" | "tags">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Refresca un asset puntual (cuando llega media.updated por WebSocket). */
  refreshOne: (id: string) => Promise<void>;
}

export interface UploadOptions {
  conversationId?: string;
  phoneNumberId?: string;
  inLibrary?: boolean;
  title?: string;
  tags?: string[];
}

const DEFAULT_FILTERS: MediaFilters = { scope: "all", kinds: [], search: "", tags: [] };

function buildQuery(filters: MediaFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), limit: "40", scope: filters.scope });
  if (filters.kinds.length) params.set("kinds", filters.kinds.join(","));
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
}

export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<MediaAsset> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.conversationId) form.append("conversationId", options.conversationId);
  if (options.phoneNumberId) form.append("phoneNumberId", options.phoneNumberId);
  if (options.inLibrary) form.append("inLibrary", "true");
  if (options.title) form.append("title", options.title);
  if (options.tags?.length) form.append("tags", options.tags.join(","));
  return api.upload<MediaAsset>("/media/upload", form);
}

export const useMediaStore = create<MediaState>((set, get) => ({
  assets: [],
  usage: null,
  tags: [],
  filters: DEFAULT_FILTERS,
  page: 1,
  pages: 1,
  total: 0,
  isLoading: false,
  isUploading: false,
  error: null,

  setFilters: (patch) => {
    set((state) => ({ filters: { ...state.filters, ...patch } }));
    void get().fetch(1);
  },

  fetch: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<PaginatedResponse<MediaAsset>>(
        `/media?${buildQuery(get().filters, page)}`
      );
      set({
        assets: data.data,
        page: data.meta.page,
        pages: data.meta.pages,
        total: data.meta.total,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof ApiError ? error.message : "No se pudieron cargar los archivos.",
      });
    }
  },

  fetchUsage: async () => {
    try {
      set({ usage: await api.get<MediaUsage>("/media/usage") });
    } catch {
      // el uso es informativo: si falla no rompe la pantalla
    }
  },

  fetchTags: async () => {
    try {
      const data = await api.get<{ tags: string[] }>("/media/tags");
      set({ tags: data.tags });
    } catch {
      // ídem
    }
  },

  upload: async (file, options = {}) => {
    set({ isUploading: true, error: null });
    try {
      const asset = await uploadMedia(file, options);
      set((state) => ({
        isUploading: false,
        assets: state.assets.some((a) => a.id === asset.id) ? state.assets : [asset, ...state.assets],
        total: state.total + 1,
      }));
      void get().fetchUsage();
      return asset;
    } catch (error) {
      set({ isUploading: false });
      throw error;
    }
  },

  update: async (id, patch) => {
    const updated = await api.patch<MediaAsset>(`/media/${id}`, patch);
    set((state) => ({ assets: state.assets.map((a) => (a.id === id ? updated : a)) }));
  },

  remove: async (id) => {
    await api.delete(`/media/${id}`);
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
      total: Math.max(0, state.total - 1),
    }));
    void get().fetchUsage();
  },

  refreshOne: async (id) => {
    if (!get().assets.some((a) => a.id === id)) return;
    try {
      const asset = await api.get<MediaAsset>(`/media/${id}`);
      set((state) => ({ assets: state.assets.map((a) => (a.id === id ? asset : a)) }));
    } catch {
      // si desapareció, el próximo fetch lo saca de la lista
    }
  },
}));
