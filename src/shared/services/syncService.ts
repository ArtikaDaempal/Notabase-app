/**
 * shared/services/syncService.ts
 * Offline Sync Queue Service (BR-SYNC & 01-architecture.md §3.4)
 *
 * Mengelola antrean operasi yang tertunda (pending_sync) saat offline,
 * dengan dukungan SQLite/Tauri Plugin SQL jika berjalan di Desktop App,
 * dan fallback otomatis ke IndexedDB (Dexie) jika berjalan di Browser Web/Next.js.
 *
 * Dokumen acuan:
 *   01-architecture.md §3.4 (Arsitektur Offline-First & SQLite Local Queue)
 *   03-business-rules.md §7 (BR-SYNC: Retry 3x, Exponential Backoff, Auto-Sync)
 */

import { localDb, enqueueSyncOp } from '@/lib/local-db'
import { createWorkspaceSupabaseClient } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SyncOperation = 'create' | 'update' | 'delete'

export interface SyncQueueItem {
  id: string
  operation: SyncOperation
  table: string
  localId: string
  workspaceId: string
  payload: Record<string, unknown>
  createdAt: string
  retries: number
  lastError?: string | null
}

export interface SyncStatusSummary {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  lastSyncAt: string | null
  errorsCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite / Tauri Plugin Helper (Feature Detection)
// ─────────────────────────────────────────────────────────────────────────────

interface TauriDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number }>
  select<T>(query: string, bindValues?: unknown[]): Promise<T>
}

let tauriSqlDb: TauriDatabase | null = null

async function getTauriSqlDb(): Promise<TauriDatabase | null> {
  if (tauriSqlDb) return tauriSqlDb

  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      // Dynamic import tauri plugin sql jika ada (safe for web Turbopack)
      const importSql = new Function("return import('@tauri-apps/plugin-sql')")
      const plugin = await importSql()
      const Database = plugin.default
      const dbInstance = await Database.load('sqlite:notabase_local.db')
      
      // Inisialisasi tabel sync_queue di SQLite
      await dbInstance.execute(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          tbl TEXT NOT NULL,
          local_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          retries INTEGER DEFAULT 0,
          last_error TEXT
        );
      `)
      tauriSqlDb = dbInstance
      return tauriSqlDb
    } catch {
      tauriSqlDb = null
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Service Implementation
// ─────────────────────────────────────────────────────────────────────────────

let isSyncingActive = false
let lastSyncTimestamp: string | null = null
const MAX_RETRIES = 3

export const syncService = {
  /**
   * Cek status koneksi jaringan internet (BR-SYNC-01).
   */
  isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine
    }
    return true
  },

  /**
   * Tambahkan operasi (CREATE, UPDATE, DELETE) ke antrean offline `pending_sync`.
   * Mendukung SQLite (Tauri) & IndexedDB (Dexie).
   *
   * @param operation   - 'create' | 'update' | 'delete'
   * @param table       - nama tabel ('receipts', 'receipt_items', dll)
   * @param localId     - UUID record lokal
   * @param workspaceId - UUID workspace
   * @param payload     - data payload operasi
   */
  async enqueue(
    operation: SyncOperation,
    table: string,
    localId: string,
    workspaceId: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    const tauriDb = await getTauriSqlDb()
    if (tauriDb) {
      // Simpan di SQLite local db (01-architecture.md §3.4)
      await tauriDb.execute(
        `INSERT INTO sync_queue (id, operation, tbl, local_id, workspace_id, payload, created_at, retries, last_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        [id, operation, table, localId, workspaceId, JSON.stringify(payload), createdAt],
      )
    } else {
      // Fallback ke Dexie IndexedDB (Web Browser / Next.js)
      await enqueueSyncOp({
        operation,
        table: table as any,
        localId,
        workspaceId,
        payload: payload as any,
        createdAt,
        retries: 0,
        lastError: null,
      })
    }

    // Jika sedang online, otomatis pemicu sync queue (BR-SYNC-02)
    if (this.isOnline() && !isSyncingActive) {
      setTimeout(() => this.processSyncQueue(workspaceId), 100)
    }

    return id
  },

  /**
   * Hitung jumlah antrean `pending_sync` untuk workspace tertentu.
   *
   * @param workspaceId - UUID workspace
   */
  async getPendingCount(workspaceId: string): Promise<number> {
    const tauriDb = await getTauriSqlDb()
    if (tauriDb) {
      const rows = await tauriDb.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE workspace_id = ?`,
        [workspaceId],
      )
      return rows[0]?.count ?? 0
    } else {
      return await localDb.syncQueue
        .where('workspaceId')
        .equals(workspaceId)
        .count()
    }
  },

  /**
   * Ambil daftar antrean sync queue.
   *
   * @param workspaceId - UUID workspace
   */
  async getSyncQueue(workspaceId: string): Promise<SyncQueueItem[]> {
    const tauriDb = await getTauriSqlDb()
    if (tauriDb) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await tauriDb.select<any[]>(
        `SELECT * FROM sync_queue WHERE workspace_id = ? ORDER BY created_at ASC`,
        [workspaceId],
      )
      return rows.map((r) => ({
        id: r.id,
        operation: r.operation as SyncOperation,
        table: r.tbl,
        localId: r.local_id,
        workspaceId: r.workspace_id,
        payload: JSON.parse(r.payload || '{}'),
        createdAt: r.created_at,
        retries: r.retries || 0,
        lastError: r.last_error || null,
      }))
    } else {
      const items = await localDb.syncQueue
        .where('workspaceId')
        .equals(workspaceId)
        .sortBy('createdAt')

      return items.map((it) => ({
        id: String(it.id ?? ''),
        operation: it.operation as SyncOperation,
        table: it.table,
        localId: it.localId,
        workspaceId: it.workspaceId,
        payload: it.payload as Record<string, unknown>,
        createdAt: it.createdAt,
        retries: it.retries,
        lastError: it.lastError,
      }))
    }
  },

  /**
   * Eksekusi seluruh antrean `pending_sync` ke Supabase satu per satu (BR-SYNC-02).
   * Sertakan retry logic (maksimal 3x) dan penanganan error.
   *
   * @param workspaceId - UUID workspace
   */
  async processSyncQueue(workspaceId: string): Promise<{ successCount: number; errorCount: number }> {
    if (isSyncingActive) {
      return { successCount: 0, errorCount: 0 }
    }
    if (!this.isOnline()) {
      console.log('[Notabase Sync] Offline — penundaan eksekusi antrean.')
      return { successCount: 0, errorCount: 0 }
    }

    isSyncingActive = true
    let successCount = 0
    let errorCount = 0

    try {
      const queue = await this.getSyncQueue(workspaceId)
      if (queue.length === 0) {
        lastSyncTimestamp = new Date().toISOString()
        return { successCount: 0, errorCount: 0 }
      }

      console.log(`[Notabase Sync] Memulai proses ${queue.length} antrean pending_sync...`)
      const client = createWorkspaceSupabaseClient(workspaceId)
      const tauriDb = await getTauriSqlDb()

      for (const item of queue) {
        if (!this.isOnline()) break

        try {
          // Send operation to Supabase
          if (item.operation === 'create') {
            const { error } = await client
              .from(item.table as any)
              .insert(item.payload as any)

            if (error && error.code !== '23505') { // Ignore duplicate key errors on retry
              throw error
            }
          } else if (item.operation === 'update') {
            const { error } = await client
              .from(item.table as any)
              .update(item.payload as any)
              .eq('id', item.localId)

            if (error) throw error
          } else if (item.operation === 'delete') {
            const { error } = await client
              .from(item.table as any)
              .update({ is_deleted: true, deleted_at: new Date().toISOString() } as any)
              .eq('id', item.localId)

            if (error) throw error
          }

          // Sukses: Hapus dari queue
          if (tauriDb) {
            await tauriDb.execute(`DELETE FROM sync_queue WHERE id = ?`, [item.id])
          } else if (item.id) {
            const numericId = Number(item.id)
            if (!isNaN(numericId)) {
              await localDb.syncQueue.delete(numericId)
            } else {
              await localDb.syncQueue.where('localId').equals(item.localId).delete()
            }
          }

          // Update status lokal di IndexedDB
          if (item.table === 'receipts') {
            await localDb.receipts.update(item.localId, { synced: true, pendingDelete: false })
          }

          successCount++
        } catch (err: any) {
          errorCount++
          const errMsg = err?.message || String(err)
          const newRetries = item.retries + 1

          console.warn(`[Notabase Sync] Gagal sync item ${item.id} (Attempt ${newRetries}/${MAX_RETRIES}):`, errMsg)

          if (newRetries >= MAX_RETRIES) {
            console.error(`[Notabase Sync] Max retries reached for item ${item.id}. Keeping for manual review.`)
          }

          // Update retries & lastError
          if (tauriDb) {
            await tauriDb.execute(
              `UPDATE sync_queue SET retries = ?, last_error = ? WHERE id = ?`,
              [newRetries, errMsg, item.id],
            )
          } else if (item.id) {
            const numericId = Number(item.id)
            if (!isNaN(numericId)) {
              await localDb.syncQueue.update(numericId, {
                retries: newRetries,
                lastError: errMsg,
              })
            }
          }
        }
      }

      lastSyncTimestamp = new Date().toISOString()
    } finally {
      isSyncingActive = false
    }

    return { successCount, errorCount }
  },

  /**
   * Hapus antrean sync queue untuk workspace tertentu.
   *
   * @param workspaceId - UUID workspace
   */
  async clearSyncQueue(workspaceId: string): Promise<void> {
    const tauriDb = await getTauriSqlDb()
    if (tauriDb) {
      await tauriDb.execute(`DELETE FROM sync_queue WHERE workspace_id = ?`, [workspaceId])
    } else {
      await localDb.syncQueue.where('workspaceId').equals(workspaceId).delete()
    }
  },

  /**
   * Dapatkan ringkasan status sinkronisasi saat ini.
   *
   * @param workspaceId - UUID workspace
   */
  async getStatusSummary(workspaceId: string): Promise<SyncStatusSummary> {
    const pendingCount = await this.getPendingCount(workspaceId)
    const queue = await this.getSyncQueue(workspaceId)
    const errorsCount = queue.filter((item) => item.retries > 0).length

    return {
      isOnline: this.isOnline(),
      pendingCount,
      isSyncing: isSyncingActive,
      lastSyncAt: lastSyncTimestamp,
      errorsCount,
    }
  },

  /**
   * Pasang event listener otomatis saat perangkat kembali online (BR-SYNC-02).
   *
   * @param workspaceId - UUID workspace
   */
  initAutoSyncListener(workspaceId: string): () => void {
    if (typeof window === 'undefined') return () => {}

    const handleOnline = () => {
      console.log('[Notabase Sync] Perangkat kembali ONLINE. Memulai auto-sync...')
      this.processSyncQueue(workspaceId)
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  },
}
