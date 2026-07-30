/**
 * store/workspace-store.ts
 * Zustand store untuk state workspace (identitas instansi/UMKM).
 *
 * Dokumen acuan:
 *   03-business-rules.md §1 (BR-WS-01 s.d. BR-WS-04)
 *   01-architecture.md §6 (Keamanan — workspace JWT)
 *
 * Persistence: workspace config disimpan di localStorage dengan key
 * 'notabase_workspace'. IndexedDB (local-db.ts) juga menyimpan salinan
 * sebagai workspaceConfig entry untuk akses offline.
 */

'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LocalWorkspaceConfig } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// State & Actions
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceState {
  // Core workspace identity (null = belum setup)
  workspaceId: string | null
  workspaceCode: string | null
  workspaceName: string | null
  workspaceLogoUrl: string | null

  // Device identity (BR-WS-02: install_id disimpan lokal)
  installId: string | null
  deviceId: string | null
  deviceName: string | null

  // Setup state
  isSetupComplete: boolean

  // Actions
  setWorkspace: (config: LocalWorkspaceConfig & { logoUrl?: string | null }) => void
  clearWorkspace: () => void         // BR-WS-04: ganti workspace = logout implisit
  updateDeviceId: (deviceId: string) => void
  updateLogoUrl: (logoUrl: string | null) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Install ID Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate UUID v4 untuk install_id perangkat.
 * Dipanggil sekali saat pertama kali app dijalankan.
 * BR-WS-02: disimpan di local storage, dikirim ke tabel devices.
 */
export function generateInstallId(): string {
  // crypto.randomUUID() tersedia di modern browsers & Node 14.17+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      // Initial state — Default to Single-Tenant Workspace for seamless app loading
      workspaceId: '00000000-0000-4000-a000-000000000000',
      workspaceCode: 'BLSDM-MND-9842X',
      workspaceName: 'BLSDM KOMDIGI MANADO',
      workspaceLogoUrl: '/kominfo-logo.png',
      installId: 'bpsdmp-default-install-id',
      deviceId: 'bpsdmp-default-device-id',
      deviceName: 'Perangkat Utama',
      isSetupComplete: true,

      /**
       * Simpan konfigurasi workspace setelah setup berhasil.
       * Dipanggil oleh WorkspaceSetupView setelah:
       *   - Buat workspace baru (INSERT ke workspaces + devices), atau
       *   - Gabung workspace yang ada (lookup by code → get workspace_id)
       */
      setWorkspace: (config) =>
        set({
          workspaceId: config.workspaceId,
          workspaceCode: config.workspaceCode,
          workspaceName: config.workspaceName,
          workspaceLogoUrl: config.logoUrl ?? null,
          installId: config.installId,
          deviceId: config.deviceId,
          deviceName: config.deviceName,
          isSetupComplete: true,
        }),

      /**
       * Hapus workspace dari store & localStorage.
       * BR-WS-04: ganti workspace di satu perangkat = logout implisit dari data lama.
       * Data lama tidak terhapus di Supabase, hanya tidak terlihat.
       */
      clearWorkspace: () =>
        set({
          workspaceId: null,
          workspaceCode: null,
          workspaceName: null,
          workspaceLogoUrl: null,
          installId: null,
          deviceId: null,
          deviceName: null,
          isSetupComplete: false,
        }),

      updateDeviceId: (deviceId) => set({ deviceId }),
      updateLogoUrl: (logoUrl) => set({ workspaceLogoUrl: logoUrl }),
    }),
    {
      name: 'notabase_workspace',    // localStorage key
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (memoized)
// ─────────────────────────────────────────────────────────────────────────────

/** Apakah workspace sudah di-setup? */
export const selectIsSetupComplete = (s: WorkspaceState) => s.isSetupComplete

/** Ambil workspaceId (null jika belum setup). */
export const selectWorkspaceId = (s: WorkspaceState) => s.workspaceId

/** Ambil konfigurasi workspace sebagai LocalWorkspaceConfig. */
export const selectWorkspaceConfig = (s: WorkspaceState): LocalWorkspaceConfig | null => {
  if (!s.workspaceId || !s.workspaceCode || !s.workspaceName || !s.installId) return null
  return {
    workspaceId: s.workspaceId,
    workspaceCode: s.workspaceCode,
    workspaceName: s.workspaceName,
    installId: s.installId,
    deviceName: s.deviceName,
    deviceId: s.deviceId,
  }
}
