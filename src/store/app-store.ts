/**
 * store/app-store.ts
 * Global UI / navigation state.
 *
 * Dokumen acuan:
 *   02-design-system.md §3.1 (bottom nav 5 item tetap)
 *   03-business-rules.md §1 BR-WS-01 (workspace-setup sebagai entry view)
 *   types/index.ts (AppView, NavTab)
 */

'use client'

import { create } from 'zustand'
import type { AppView, NavTab, OcrResult } from '@/types'
import type { Language } from '@/lib/i18n'

interface AppState {
  // Navigation
  view: AppView
  activeTab: NavTab
  selectedReceiptId: string | null
  pendingOcr: { imageUrl: string; result: OcrResult } | null
  history: AppView[]
  language: Language

  // Actions
  navigate: (view: AppView) => void
  setTab: (tab: NavTab) => void
  openReceipt: (id: string) => void
  startOcrReview: (imageUrl: string, result: OcrResult) => void
  clearOcr: () => void
  goBack: () => void
  setLanguage: (lang: Language) => void
}

const NAV_TABS: NavTab[] = ['dashboard', 'scan', 'history', 'report', 'settings']

export const useAppStore = create<AppState>((set, get) => ({
  // Default: workspace-setup agar onboarding muncul pertama kali (BR-WS-01).
  // WorkspaceSetupView akan redirect ke 'splash' → 'dashboard' setelah setup selesai.
  view: 'dashboard',
  activeTab: 'dashboard',
  selectedReceiptId: null,
  pendingOcr: null,
  history: [],
  language: 'id',

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
      view: 'detail',
      selectedReceiptId: id,
      history: [...s.history, s.view],
    })),

  startOcrReview: (imageUrl, result) =>
    set((s) => ({
      view: 'ocr-preview',
      pendingOcr: { imageUrl, result },
      history: [...s.history, s.view],
    })),

  clearOcr: () => set({ pendingOcr: null }),

  goBack: () => {
    const h = get().history
    if (h.length === 0) {
      set({ view: 'dashboard', activeTab: 'dashboard' })
      return
    }
    const prev = h[h.length - 1]
    set({
      view: prev,
      history: h.slice(0, -1),
      activeTab: NAV_TABS.includes(prev as NavTab)
        ? (prev as NavTab)
        : get().activeTab,
    })
  },

  setLanguage: (lang) => set({ language: lang }),
}))
