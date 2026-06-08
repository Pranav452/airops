"use client";

import { create } from "zustand";

interface AiropsStore {
  selectedJobId: string | null;
  isPanelOpen: boolean;
  openPanel: (id: string) => void;
  closePanel: () => void;
}

export const useAiropsStore = create<AiropsStore>((set) => ({
  selectedJobId: null,
  isPanelOpen: false,
  openPanel: (id) => set({ selectedJobId: id, isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false, selectedJobId: null }),
}));
