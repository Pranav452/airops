"use client";

import { create } from "zustand";

interface AiropsStore {
  selectedJobId: string | null;
  isPanelOpen: boolean;
  globalSearch: string;
  openPanel: (id: string) => void;
  closePanel: () => void;
  setGlobalSearch: (q: string) => void;
}

export const useAiropsStore = create<AiropsStore>((set) => ({
  selectedJobId: null,
  isPanelOpen: false,
  globalSearch: "",
  openPanel: (id) => set({ selectedJobId: id, isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false, selectedJobId: null }),
  setGlobalSearch: (q) => set({ globalSearch: q }),
}));
