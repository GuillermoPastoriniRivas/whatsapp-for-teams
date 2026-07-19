"use client";

import { create } from "zustand";

/** Content zoom is a per-device display preference, so it lives in localStorage. */
const ZOOM_KEY = "asis-content-zoom";

export const ZOOM_OPTIONS = [1, 1.1, 1.15, 1.25, 1.4] as const;
export const DEFAULT_ZOOM = 1.15;

interface ZoomState {
  zoom: number;
  hydrated: boolean;
  /** Reads the stored value on the client, after mount, to avoid an SSR mismatch. */
  hydrate: () => void;
  setZoom: (zoom: number) => void;
}

function clamp(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_ZOOM;
  return Math.min(Math.max(zoom, ZOOM_OPTIONS[0]), ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]);
}

export const useZoomStore = create<ZoomState>((set) => ({
  zoom: DEFAULT_ZOOM,
  hydrated: false,
  hydrate: () => {
    const stored = localStorage.getItem(ZOOM_KEY);
    set({ zoom: stored ? clamp(Number(stored)) : DEFAULT_ZOOM, hydrated: true });
  },
  setZoom: (zoom) => {
    const next = clamp(zoom);
    localStorage.setItem(ZOOM_KEY, String(next));
    set({ zoom: next });
  },
}));
