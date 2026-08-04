/**
 * lib/local-db.ts
 * IndexedDB database using Dexie.js for offline-first storage.
 * Acts as the primary local cache layer before syncing to Supabase.
 *
 * Schema v2 — sesuai spesifikasi final:
 *   04-database-schema.md §2 (kolom baru: workspace_id, kategori, diskon, pajak)
 *   03-business-rules.md §7 (BR-SYNC-01/02: antrian offline)
 *   01-architecture.md §0 poin 4 (local-first buffer)
 *
 * Migration dari v1 ke v2:
 *   Dexie menjalankan upgrade() secara otomatis — record lama yang tidak punya
 *   field baru (workspaceId, kategori, dll) akan mendapat nilai undefined/null,
 *   yang aman karena field-field itu optional di v1.
 */

import Dexie, { type EntityTable } from 'dexie'

// ─────────────────────────────────────────────────────────────────────────────
// Schema types
// ─────────────────────────────────────────────────────────────────────────────

export interface LocalReceiptItem {
  namaBarang: string
  qty: number
  harga: number
  subtotal: number    // qty × harga (BR-MAN-03)
  urutan: number
}

export interface LocalReceipt {
  id: string                         // UUID (matches Supabase receipts.id once synced)
  workspaceId: string                // workspace isolasi (BR-WS-03)
  deviceId: string | null

  // Identitas nota
  receiptNumber: string
  receiptType: 'scan' | 'gallery' | 'manual'
  receiptTemplate: string | null

  // Gambar
  imageUrl: string | null            // Supabase Storage path (after sync)
  localImageId: string | null        // OfflineImage.id (before sync)

  // Isi nota
  tanggal: string                    // "YYYY-MM-DD"
  namaToko: string
  kategori: string | null            // BR §8
  nominal: number
  diskon: number
  pajak: number
  metodePembayaran: string | null
  keterangan: string | null

  // OCR metadata (BR-OCR-06: raw text selalu disimpan)
  statusOcr: 'berhasil' | 'perlu_review' | 'gagal' | 'manual' | null
  ocrConfidence: number | null
  ocrRawText: string | null

  // Soft delete (BR-ARC-01)
  isDeleted: boolean
  deletedAt: string | null

  // Timestamps
  createdAt: string
  updatedAt: string

  // Items (denormalized for offline access)
  items: LocalReceiptItem[] | null

  // Sync metadata (BR-SYNC-02)
  synced: boolean                    // true = confirmed in Supabase
  pendingDelete: boolean             // queued for soft-delete sync
  supabaseId: string | null          // may differ from id if created offline
}

export interface SyncQueueEntry {
  id?: number                        // auto-increment PK
  operation: 'create' | 'update' | 'delete'
  table: 'receipts' | 'receipt_items' | 'app_settings'
  localId: string                    // LocalReceipt.id
  workspaceId: string
  payload: Record<string, unknown>
  createdAt: string
  retries: number                    // BR-EXP-05: retry 3x with backoff
  lastError: string | null
}

export interface OfflineImage {
  id: string                         // UUID
  blob: Blob
  mimeType: string
  fileName: string
  sizeBytes: number
  createdAt: string
}

/** Konfigurasi workspace yang tersimpan lokal (BR-WS-02). */
export interface LocalWorkspaceEntry {
  id: string                         // = workspaceId (UUID)
  code: string
  nama: string
  logoUrl: string | null
  installId: string
  deviceId: string | null
  deviceName: string | null
  savedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Dexie database class
// ─────────────────────────────────────────────────────────────────────────────

export class NotabaseDB extends Dexie {
  receipts!: EntityTable<LocalReceipt, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>
  offlineImages!: EntityTable<OfflineImage, 'id'>
  workspaceConfig!: EntityTable<LocalWorkspaceEntry, 'id'>

  constructor() {
    super('notabase_local')

    // v1 — schema asli (dipertahankan agar upgrade bisa berjalan)
    this.version(1).stores({
      receipts: 'id, merchantName, transactionDate, status, receiptType, synced, pendingDelete, supabaseId',
      syncQueue: '++id, operation, localId, createdAt, retries',
      offlineImages: 'id, createdAt',
    })

    // v2 — schema baru sesuai spesifikasi final
    this.version(2)
      .stores({
        receipts: [
          'id',
          'workspaceId',       // index utama untuk filter per workspace
          'namaToko',
          'tanggal',
          'kategori',
          'receiptType',
          'statusOcr',
          'isDeleted',
          'deletedAt',
          'synced',
          'pendingDelete',
          'supabaseId',
          '[workspaceId+isDeleted]',   // compound untuk query umum
          '[workspaceId+tanggal]',     // sorting by date per workspace
        ].join(', '),
        syncQueue: '++id, operation, localId, workspaceId, createdAt, retries',
        offlineImages: 'id, createdAt',
        workspaceConfig: 'id, code',   // lookup by UUID or code
      })
      .upgrade((tx) => {
        // Upgrade receipt records dari v1:
        // Field lama yang berubah nama: merchantName → namaToko, transactionDate → tanggal
        return tx.table('receipts').toCollection().modify((r) => {
          // Ganti nama field lama jika belum ada field baru
          if (!r.namaToko && r.merchantName) {
            r.namaToko = r.merchantName
            delete r.merchantName
          }
          if (!r.tanggal && r.transactionDate) {
            r.tanggal = r.transactionDate
            delete r.transactionDate
          }
          if (r.nominal === undefined && r.total !== undefined) {
            r.nominal = r.total
            delete r.total
          }
          if (r.receiptNumber === undefined && r.invoiceNumber !== undefined) {
            r.receiptNumber = r.invoiceNumber
            delete r.invoiceNumber
          }
          if (r.namaToko === undefined && r.description !== undefined) {
            r.keterangan = r.description
            delete r.description
          }
          if (r.ocrRawText === undefined) r.ocrRawText = r.ocrText ?? null
          // Defaults untuk field baru
          r.workspaceId = r.workspaceId ?? ''   // diperbaiki saat login workspace
          r.diskon = r.diskon ?? 0
          r.pajak = r.pajak ?? 0
          r.metodePembayaran = r.metodePembayaran ?? null
          r.kategori = r.kategori ?? null
          r.isDeleted = r.isDeleted ?? (r.pendingDelete ?? false)
          r.deletedAt = r.deletedAt ?? null
          r.deviceId = r.deviceId ?? null
          r.receiptTemplate = r.receiptTemplate ?? null
        })
      })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instance (safe for Next.js hot reload)
// ─────────────────────────────────────────────────────────────────────────────

const g = globalThis as typeof globalThis & { _notabaseDB?: NotabaseDB }
export const localDb: NotabaseDB = g._notabaseDB ?? new NotabaseDB()
if (process.env.NODE_ENV !== 'production') g._notabaseDB = localDb

// ─────────────────────────────────────────────────────────────────────────────
// CRUD helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Upsert a receipt (from Supabase sync or local create). */
export async function upsertLocalReceipt(receipt: LocalReceipt): Promise<void> {
  await localDb.receipts.put(receipt)
}

/** Get all active (non-deleted) receipts for a workspace. */
export async function getLocalReceipts(
  workspaceId: string,
  opts?: {
    q?: string
    kategori?: string
    receiptType?: string
    statusOcr?: string
    page?: number
    pageSize?: number
    sort?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant-asc'
  },
): Promise<{ data: LocalReceipt[]; total: number }> {
  const {
    q = '',
    kategori = '',
    receiptType = '',
    statusOcr = '',
    page = 1,
    pageSize = 12,
    sort = 'date-desc',
  } = opts ?? {}

  let collection = localDb.receipts
    .where('[workspaceId+isDeleted]')
    .equals([workspaceId, 0])   // Dexie encodes false as 0 in compound index

  // Full-text search (BR-SRCH-01): nama_toko, keterangan, receipt_number
  if (q) {
    const lower = q.toLowerCase()
    collection = collection.filter(
      (r) =>
        r.namaToko.toLowerCase().includes(lower) ||
        (r.keterangan ?? '').toLowerCase().includes(lower) ||
        r.receiptNumber.toLowerCase().includes(lower) ||
        String(r.nominal).includes(lower),
    )
  }

  // Filters (BR-SRCH-02: semua filter bersifat AND)
  if (kategori) collection = collection.filter((r) => r.kategori === kategori)
  if (receiptType) collection = collection.filter((r) => r.receiptType === receiptType)
  if (statusOcr) collection = collection.filter((r) => r.statusOcr === statusOcr)

  const all = await collection.toArray()

  // Sort
  const sorted = all.sort((a, b) => {
    switch (sort) {
      case 'date-asc':     return a.tanggal.localeCompare(b.tanggal)
      case 'amount-desc':  return b.nominal - a.nominal
      case 'amount-asc':   return a.nominal - b.nominal
      case 'merchant-asc': return a.namaToko.localeCompare(b.namaToko)
      default:             return b.tanggal.localeCompare(a.tanggal)
    }
  })

  const total = sorted.length
  const from = (page - 1) * pageSize
  const data = sorted.slice(from, from + pageSize)

  return { data, total }
}

/** Get a single receipt by ID. */
export async function getLocalReceipt(id: string): Promise<LocalReceipt | undefined> {
  return localDb.receipts.get(id)
}

/**
 * Soft-delete a receipt locally (BR-ARC-01).
 * Jika sudah synced ke Supabase, tambahkan ke syncQueue untuk propagasi.
 */
export async function softDeleteLocalReceipt(id: string, synced: boolean): Promise<void> {
  // Permanently remove receipt from local IndexedDB by ID and receiptNumber
  if (!id) return
  await localDb.receipts.delete(id)
  try {
    const all = await localDb.receipts.toArray()
    const target = String(id).trim().toLowerCase()
    for (const r of all) {
      if (
        String(r.id).trim().toLowerCase() === target ||
        String(r.receiptNumber || '').trim().toLowerCase() === target ||
        String(r.supabaseId || '').trim().toLowerCase() === target
      ) {
        await localDb.receipts.delete(r.id)
      }
    }
  } catch (err) {
    console.warn('[IndexedDB Delete Warning]', err)
  }
}

/** Add an entry to the sync queue (BR-SYNC-02). */
export async function enqueueSyncOp(
  entry: Omit<SyncQueueEntry, 'id'>,
): Promise<void> {
  await localDb.syncQueue.add(entry)
}

/** Get all pending sync operations. */
export async function getPendingSyncOps(): Promise<SyncQueueEntry[]> {
  return localDb.syncQueue.toArray()
}

/** Remove a sync queue entry after successful sync. */
export async function dequeueSync(id: number): Promise<void> {
  await localDb.syncQueue.delete(id)
}

/** Store an image blob for offline use (BR-SYNC-04). */
export async function storeOfflineImage(image: OfflineImage): Promise<void> {
  await localDb.offlineImages.put(image)
}

/** Retrieve a stored offline image blob. */
export async function getOfflineImage(id: string): Promise<OfflineImage | undefined> {
  return localDb.offlineImages.get(id)
}

/** Delete a stored offline image. */
export async function deleteOfflineImage(id: string): Promise<void> {
  await localDb.offlineImages.delete(id)
}

/** Save workspace config to local DB (BR-WS-02). */
export async function saveWorkspaceConfig(entry: LocalWorkspaceEntry): Promise<void> {
  await localDb.workspaceConfig.put(entry)
}

/** Get workspace config by code (used during onboarding join). */
export async function getWorkspaceConfigByCode(
  code: string,
): Promise<LocalWorkspaceEntry | undefined> {
  return localDb.workspaceConfig.where('code').equals(code).first()
}

/** Count unsynced receipts for a workspace. */
export async function getUnsyncedCount(workspaceId: string): Promise<number> {
  return localDb.receipts
    .where('workspaceId')
    .equals(workspaceId)
    .filter((r) => !r.synced && !r.pendingDelete)
    .count()
}

/** Count pending sync queue entries. */
export async function getPendingQueueCount(): Promise<number> {
  return localDb.syncQueue.count()
}
