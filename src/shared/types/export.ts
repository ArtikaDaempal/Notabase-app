/**
 * shared/types/export.ts
 * TypeScript interfaces and types for Export History & Reporting.
 * Dokumen acuan: 04-database-schema.md §2 (tabel export_history), 03-business-rules.md §6
 */

import type { PeriodType, ExportStatus } from './database'

export type { PeriodType, ExportStatus }

/** Domain interface untuk Riwayat Ekspor (tabel `export_history`). */
export interface ExportHistory {
  id: string
  workspaceId: string
  deviceId: string | null

  fileName: string
  periodType: PeriodType | null
  periodStart: string | null        // "YYYY-MM-DD"
  periodEnd: string | null          // "YYYY-MM-DD"
  totalBaris: number | null
  totalNominal: number | null

  status: ExportStatus | null
  uploadedOnedrive: boolean
  onedrivePath: string | null

  createdAt: string
}
