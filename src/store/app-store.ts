import { create } from "zustand";
import type { AppView, NavTab, OcrResult } from "@/types";

interface AppState {
  // Navigation
  view: AppView;
  activeTab: NavTab;
  selectedReceiptId: string | null;
  pendingOcr: { imageUrl: string; result: OcrResult } | null;
  history: AppView[];

  // Actions
  navigate: (view: AppView) => void;
  setTab: (tab: NavTab) => void;
  openReceipt: (id: string) => void;
  startOcrReview: (imageUrl: string, result: OcrResult) => void;
  clearOcr: () => void;
  goBack: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "splash",
  activeTab: "dashboard",
  selectedReceiptId: null,
  pendingOcr: null,
  history: [],

  navigate: (view) =>
    set((s) => ({
      view,
      history: [...s.history, s.view],
    })),

  setTab: (tab) =>
    set((s) => ({
      view: tab,
      activeTab: tab,
      history: [...s.history, s.view],
    })),

  openReceipt: (id) =>
    set((s) => ({
      view: "detail",
      selectedReceiptId: id,
      history: [...s.history, s.view],
    })),

  startOcrReview: (imageUrl, result) =>
    set((s) => ({
      view: "ocr-preview",
      pendingOcr: { imageUrl, result },
      history: [...s.history, s.view],
    })),

  clearOcr: () => set({ pendingOcr: null }),

  goBack: () => {
    const h = get().history;
    if (h.length === 0) {
      set({ view: "dashboard", activeTab: "dashboard" });
      return;
    }
    const prev = h[h.length - 1];
    set({
      view: prev,
      history: h.slice(0, -1),
      activeTab:
        prev === "dashboard" || prev === "scan" || prev === "history" || prev === "settings"
          ? (prev as NavTab)
          : get().activeTab,
    });
  },
}));
