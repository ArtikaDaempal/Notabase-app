/**
 * shared/types/onedrive.ts
 * TypeScript interfaces and types for OneDrive Connection & Sync Logs.
 * Dokumen acuan: 04-database-schema.md §2 (tabel onedrive_connections), 01-architecture.md §6
 */

import type { OneDriveStatus } from './database'

export type { OneDriveStatus }

/** Domain interface untuk Koneksi OneDrive (tabel `onedrive_connections`). */
export interface OneDriveConnection {
  id: string
  workspaceId: string
  accountEmail: string
  connectedAt: string
  status: OneDriveStatus
  storageUsedBytes: number | null
  storageTotalBytes: number | null
  lastCheckedAt: string | null
}

/** Interface log sinkronisasi untuk antrian upload offline & status banner. */
export interface SyncLog {
  id: string
  fileName: string
  status: 'pending' | 'uploading' | 'success' | 'failed'
  progress: number
  fileSize: number | null
  provider: 'onedrive'
  message: string | null
  createdAt: string
  updatedAt: string
}
