/**
 * types/index.ts
 * Notabase application types barrel.
 * Re-exports shared domain types from shared/types + UI navigation types.
 *
 * Dokumen acuan:
 *   04-database-schema.md  — struktur data
 *   03-business-rules.md   — enum & aturan validasi
 *   02-design-system.md    — NavTab (5 item), AppView
 */

// Re-export all domain types from shared/types
export * from '@/shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// UI Navigation & View Types
// ─────────────────────────────────────────────────────────────────────────────

/** Full set of application views/screens. */
export type AppView =
  | 'workspace-setup'   // onboarding — buat/gabung workspace (BR-WS-01)
  | 'splash'
  | 'dashboard'
  | 'scan'
  | 'ocr-preview'
  | 'history'
  | 'detail'
  | 'report'            // export Excel (PRD §9)
  | 'onedrive'
  | 'settings'
  | 'search'
  | 'upload-progress'
  | 'gallery'

/** Bottom navigation tabs — 5 item tetap (02-design-system.md §3.1). */
export type NavTab =
  | 'dashboard'
  | 'scan'
  | 'history'
  | 'report'
  | 'settings'

// ─────────────────────────────────────────────────────────────────────────────
// App Settings Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppSettingKey =
  | 'bahasa'
  | 'format_gambar'
  | 'hapus_setelah_upload'
  | 'folder_simpan_default'
  | 'tema'
  | 'kategori_custom'
  | 'nama_perangkat'
  | 'receipt_template_default'

export interface AppSetting {
  id: string
  workspaceId: string
  key: AppSettingKey | string
  value: unknown
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Analytics Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  today: { count: number; total: number }
  week: { count: number; total: number }
  month: { count: number; total: number }
  allTime: { count: number; total: number }
  chart: { label?: string; name?: string; value: number }[]
  chartMonthly?: { label?: string; name?: string; value: number }[]
  topMerchants: { name: string; count: number; total: number }[]
  recent: import('@/shared/types').Receipt[]
}
