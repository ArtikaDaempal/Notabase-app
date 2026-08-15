/**
 * lib/sync-service.ts
 * Online-First Sync Service — sesuai 01-architecture.md §3.1 & 03-business-rules.md §7
 *
 * Alur:
 *   Online  → Simpan langsung ke Supabase → cache IndexedDB sebagai backup
 *   Offline → Simpan ke IndexedDB (status pending_sync) → sync otomatis saat online
 *
 * BR-SYNC-01: create/update/delete broadcast via Supabase Realtime
 * BR-SYNC-02: offline → antrian lokal pending_sync, auto-sync saat online
 * BR-SYNC-03: konflik → last-write-wins berdasarkan updated_at
 * BR-EXP-05:  retry 3x dengan backoff sebelum tampilkan error
 */

'use client'

import { localDb, type LocalReceipt, type SyncQueueEntry } from './local-db'
import type { Receipt } from '@/types'
import { isValidInvoiceNumber } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Online Status Detection
// ─────────────────────────────────────────────────────────────────────────────

let _isOnline: boolean = typeof window !== 'undefined' ? window.navigator.onLine : true
let _onlineListeners: Array<(online: boolean) => void> = []

/** Cek status online saat ini (state sinkron, tidak ada network call). */
export function isOnline(): boolean {
  return _isOnline
}

/** Daftarkan callback yang dipanggil saat status online/offline berubah. */
export function watchOnlineStatus(callback: (online: boolean) => void): () => void {
  _onlineListeners.push(callback)
  return () => {
    _onlineListeners = _onlineListeners.filter((cb) => cb !== callback)
  }
}

/** Inisialisasi event listener online/offline (dipanggil sekali di root). */
export function initOnlineWatcher(onBack?: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = () => {
    _isOnline = true
    _onlineListeners.forEach((cb) => cb(true))
    // Auto-process sync queue dan sync semua nota lokal yang tersimpan sebelumnya
    processSyncQueue().catch(console.warn)
    syncAllUnsyncedReceipts().catch(console.warn)
    onBack?.()
  }

  // Trigger sync langsung saat watcher pertama kali aktif jika status online
  if (_isOnline) {
    setTimeout(() => {
      syncAllUnsyncedReceipts().catch(console.warn)
    }, 1000)
  }

  const handleOffline = () => {
    _isOnline = false
    _onlineListeners.forEach((cb) => cb(false))
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Queue State (client-side reactive count)
// ─────────────────────────────────────────────────────────────────────────────

let _pendingCount = 0
let _pendingListeners: Array<(count: number) => void> = []

export function getPendingCount(): number {
  return _pendingCount
}

export function watchPendingCount(callback: (count: number) => void): () => void {
  _pendingListeners.push(callback)
  callback(_pendingCount)
  return () => {
    _pendingListeners = _pendingListeners.filter((cb) => cb !== callback)
  }
}

async function refreshPendingCount(): Promise<void> {
  try {
    const count = await localDb.syncQueue.count()
    _pendingCount = count
    _pendingListeners.forEach((cb) => cb(count))
  } catch {
    // ignore IndexedDB errors in SSR
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save Receipt — Online First
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveResult {
  receipt: Receipt
  synced: boolean       // true = berhasil ke Supabase
  pendingSync: boolean  // true = tersimpan lokal, menunggu sync
}

/**
 * Simpan nota dengan strategi Online-First:
 * 1. Jika online → POST ke /api/receipts → simpan lokal sebagai cache (synced=true)
 * 2. Jika offline / gagal → simpan ke IndexedDB + tambah ke syncQueue (synced=false)
 */
export async function saveReceiptOnlineFirst(
  payload: Record<string, unknown>,
  workspaceId: string,
): Promise<SaveResult> {
  const receiptId = (payload.id as string) || crypto.randomUUID()
  const now = new Date().toISOString()
  const namaToko = (payload.namaToko || payload.merchantName || '-') as string
  const tanggal = ((payload.tanggal || payload.transactionDate || now) as string).split('T')[0]
  const nominal = Number(payload.nominal ?? payload.total) || 0
  const rawNum = (payload.receiptNumber as string) || (payload.invoiceNumber as string) || ''
  const receiptNumber = isValidInvoiceNumber(rawNum) ? rawNum.trim() : ''

  // Siapkan objek receipt standar
  const receiptObj: Receipt = {
    id: receiptId,
    workspaceId,
    receiptNumber,
    invoiceNumber: receiptNumber,
    namaToko,
    merchantName: namaToko,
    tanggal,
    transactionDate: tanggal,
    nominal,
    total: nominal,
    diskon: Number(payload.diskon) || 0,
    pajak: Number(payload.pajak) || 0,
    keterangan: (payload.keterangan || payload.description || null) as string | null,
    description: (payload.keterangan || payload.description || null) as string | null,
    imageUrl: (payload.imageUrl || null) as string | null,
    ocrRawText: (payload.ocrRawText || payload.ocrText || null) as string | null,
    ocrText: (payload.ocrRawText || payload.ocrText || null) as string | null,
    ocrConfidence: Number(payload.ocrConfidence ?? payload.confidence) || 85,
    confidence: Number(payload.ocrConfidence ?? payload.confidence) || 85,
    statusOcr: (payload.statusOcr || payload.status || 'berhasil') as import('@/shared/types').StatusOcr,
    status: (payload.statusOcr || payload.status || 'berhasil') as import('@/shared/types').StatusOcr,
    receiptType: (payload.receiptType || 'scan') as import('@/shared/types').ReceiptType,
    items: (payload.items as Receipt['items']) || [],
    deviceId: (payload.deviceId as string | null) || null,
    receiptTemplate: (payload.receiptTemplate as string | null) || null,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  // ── Coba simpan ke Supabase jika online ──────────────────────────────────
  if (_isOnline) {
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ ...payload, id: receiptId, workspaceId }),
      })

      if (res.ok) {
        const data = await res.json()
        // Simpan ke IndexedDB sebagai cache lokal (synced=true)
        await upsertLocalCache({ ...receiptObj, ...data }, true)
        await refreshPendingCount()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
          window.dispatchEvent(new Event('receipts-updated'))
          window.dispatchEvent(new Event('receipt-saved'))
        }
        return { receipt: data || receiptObj, synced: true, pendingSync: false }
      }
    } catch (err) {
      console.warn('[SyncService] Online save failed, falling back to local:', err)
    }
  }

  // ── Fallback: simpan lokal + antrian sync ────────────────────────────────
  await upsertLocalCache(receiptObj, false)

  // Tambahkan ke sync queue (BR-SYNC-02)
  try {
    await localDb.syncQueue.add({
      operation: 'create',
      table: 'receipts',
      localId: receiptId,
      workspaceId,
      payload: { ...payload, id: receiptId, workspaceId },
      createdAt: now,
      retries: 0,
      lastError: null,
    } as SyncQueueEntry)
  } catch (queueErr) {
    console.warn('[SyncService] Failed to enqueue sync op:', queueErr)
  }

  await refreshPendingCount()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
    window.dispatchEvent(new Event('receipts-updated'))
    window.dispatchEvent(new Event('receipt-saved'))
  }
  return { receipt: receiptObj, synced: false, pendingSync: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Cache Helper
// ─────────────────────────────────────────────────────────────────────────────

async function upsertLocalCache(receipt: Receipt, synced: boolean): Promise<void> {
  try {
    await localDb.receipts.put({
      id: receipt.id,
      workspaceId: receipt.workspaceId || '',
      deviceId: null,
      receiptNumber: receipt.receiptNumber || receipt.invoiceNumber || '',
      receiptType: (receipt.receiptType || 'scan') as LocalReceipt['receiptType'],
      receiptTemplate: null,
      imageUrl: receipt.imageUrl || null,
      localImageId: null,
      tanggal: receipt.tanggal || receipt.transactionDate || '',
      namaToko: receipt.namaToko || receipt.merchantName || '',
      nominal: Number(receipt.nominal ?? receipt.total) || 0,
      diskon: Number(receipt.diskon) || 0,
      pajak: Number(receipt.pajak) || 0,
      keterangan: receipt.keterangan || receipt.description || null,
      statusOcr: (receipt.statusOcr || 'berhasil') as LocalReceipt['statusOcr'],
      ocrConfidence: Number(receipt.ocrConfidence ?? receipt.confidence) || null,
      ocrRawText: receipt.ocrRawText || receipt.ocrText || null,
      isDeleted: false,
      deletedAt: null,
      createdAt: receipt.createdAt || new Date().toISOString(),
      updatedAt: receipt.updatedAt || new Date().toISOString(),
      items: Array.isArray(receipt.items)
        ? receipt.items.map((it: any, idx: number) => ({
            namaBarang: it.namaBarang || it.name || '',
            qty: Number(it.qty) || 1,
            harga: Number(it.harga ?? it.price) || 0,
            subtotal: Number(it.subtotal ?? it.total) || 0,
            urutan: it.urutan ?? idx,
          }))
        : [],
      synced,
      pendingDelete: false,
      supabaseId: synced ? receipt.id : null,
    })
  } catch (err) {
    // IndexedDB mungkin tidak tersedia di SSR
    console.warn('[SyncService] Local cache upsert failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Process Sync Queue
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1500

/**
 * Proses semua antrian sync yang tertunda ke Supabase.
 * BR-EXP-05: retry 3x dengan backoff sebelum tandai gagal.
 * BR-SYNC-03: last-write-wins berdasarkan updated_at.
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  let synced = 0
  let failed = 0

  try {
    const pending = await localDb.syncQueue.toArray()
    if (pending.length === 0) return { synced: 0, failed: 0 }

    for (const entry of pending) {
      if (entry.retries >= MAX_RETRIES) {
        failed++
        continue
      }

      try {
        let success = false

        if (entry.operation === 'create' || entry.operation === 'update') {
          // Backoff delay
          if (entry.retries > 0) {
            await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * entry.retries))
          }

          const res = await fetch('/api/receipts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-workspace-id': entry.workspaceId,
            },
            body: JSON.stringify(entry.payload),
          })
          success = res.ok
        } else if (entry.operation === 'delete') {
          const res = await fetch(`/api/receipts/${entry.localId}`, {
            method: 'DELETE',
            headers: { 'x-workspace-id': entry.workspaceId },
          })
          success = res.ok
        }

        if (success && entry.id != null) {
          // Hapus dari queue
          await localDb.syncQueue.delete(entry.id)
          // Update status lokal menjadi synced
          await localDb.receipts.update(entry.localId, { synced: true, supabaseId: entry.localId })
          synced++
        } else {
          // Increment retry count
          if (entry.id != null) {
            await localDb.syncQueue.update(entry.id, {
              retries: entry.retries + 1,
              lastError: `HTTP error on attempt ${entry.retries + 1}`,
            })
          }
          failed++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (entry.id != null) {
          await localDb.syncQueue.update(entry.id, {
            retries: entry.retries + 1,
            lastError: msg,
          })
        }
        failed++
      }
    }
  } catch (err) {
    console.warn('[SyncService] processSyncQueue error:', err)
  }

  await refreshPendingCount()
  return { synced, failed }
}

/**
 * Pindai semua nota di IndexedDB lokal dan kirimkan nota yang belum tersimpan di Supabase.
 */
export async function syncAllUnsyncedReceipts(workspaceId: string = '00000000-0000-4000-a000-000000000000'): Promise<number> {
  if (typeof window === 'undefined' || !_isOnline) return 0
  let countSynced = 0

  try {
    const allLocal = await localDb.receipts.toArray().catch(() => [])
    const unsynced = allLocal.filter((r) => !r.synced && !r.isDeleted)

    for (const item of unsynced) {
      try {
        const payload = {
          id: item.id,
          workspaceId: item.workspaceId || workspaceId,
          receiptNumber: item.receiptNumber,
          namaToko: item.namaToko,
          tanggal: item.tanggal,
          nominal: item.nominal,
          diskon: item.diskon || 0,
          pajak: item.pajak || 0,
          keterangan: item.keterangan,
          imageUrl: item.imageUrl,
          ocrRawText: item.ocrRawText,
          statusOcr: item.statusOcr || 'berhasil',
          receiptType: item.receiptType || 'scan',
          items: item.items || [],
        }

        const res = await fetch('/api/receipts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': item.workspaceId || workspaceId,
          },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const resData = await res.json()
          if (resData.synced) {
            await localDb.receipts.update(item.id, { synced: true, supabaseId: item.id })
            countSynced++
          }
        }
      } catch (err) {
        console.warn(`[SyncService] Auto-sync failed for receipt ${item.id}:`, err)
      }
    }

    if (countSynced > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
    }
  } catch (err) {
    console.warn('[SyncService] syncAllUnsyncedReceipts error:', err)
  }

  return countSynced
}
