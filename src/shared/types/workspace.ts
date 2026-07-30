/**
 * shared/types/workspace.ts
 * TypeScript interfaces and types for Workspace & Devices.
 * Dokumen acuan: 04-database-schema.md §2, 03-business-rules.md §1
 */

import type { Platform } from './database'

export type { Platform }

/** Interface domain untuk Workspace (tabel `workspaces`). */
export interface Workspace {
  id: string
  code: string              // "BPSDMP-MANADO"
  nama: string              // "BPSDMP Kominfo Manado"
  logoUrl: string | null
  createdAt: string
}

/** Interface domain untuk Device (tabel `devices`). */
export interface Device {
  id: string
  workspaceId: string
  namaPerangkat: string | null
  platform: Platform | null
  installId: string
  lastSeenAt: string | null
  createdAt: string
}

/** Konfigurasi workspace yang disimpan lokal di perangkat (BR-WS-02). */
export interface LocalWorkspaceConfig {
  workspaceId: string
  workspaceCode: string
  workspaceName: string
  installId: string          // UUID unik per instalasi, generated on first run
  deviceName: string | null  // nama perangkat untuk audit "Admin 1"
  deviceId: string | null    // UUID dari tabel devices
}

/** Entry workspace di IndexedDB `workspaceConfig` store. */
export interface LocalWorkspaceEntry {
  id: string                 // = workspaceId
  code: string
  nama: string
  logoUrl: string | null
  installId: string
  deviceId: string | null
  deviceName: string | null
  savedAt: string
}
