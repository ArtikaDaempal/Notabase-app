/**
 * shared/services/receiptService.ts
 * Receipt Management Service: CRUD, OCR evaluation, automatic calculation of subtotal/discount/tax,
 * and auto-numbering generation.
 *
 * Dokumen acuan:
 *   03-business-rules.md (BR-MAN-01..04, BR-OCR-01..07, BR-ARC-01..04)
 *   04-database-schema.md §2 (Tabel receipts & receipt_items)
 *   01-architecture.md §4 (Logika bisnis di shared/)
 */

import { supabase, createWorkspaceSupabaseClient } from './supabase'
import { localDb, upsertLocalReceipt, softDeleteLocalReceipt, enqueueSyncOp } from '@/lib/local-db'
import { serializeReceipt, deserializeReceipt } from '@/lib/serialize'
import {
  getOcrStatus,
  isAutoSaveAllowed,
  requiresUserReview,
  isOcrFailed,
} from '@/lib/rules/ocr-rules'
import {
  generateReceiptNumber,
  calculateItemSubtotal,
  calculateTotal,
  recalculateItems,
  validateReceiptMinimum,
  validateManualReceiptItems,
} from '@/lib/rules/receipt-rules'
import { softDeleteReceipt } from '@/lib/rules/archive-rules'
import type { Receipt, ReceiptItem, OcrResult, StatusOcr, ReceiptType } from '../types/receipt'

// ─────────────────────────────────────────────────────────────────────────────
// Filter & Pagination Input Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptFilterOptions {
  q?: string                          // Search query (nama_toko, receipt_number, keterangan)
  kategori?: string | null
  receiptType?: ReceiptType | null
  statusOcr?: StatusOcr | null
  startDate?: string | null           // "YYYY-MM-DD"
  endDate?: string | null
  minNominal?: number | null
  maxNominal?: number | null
  hasImage?: boolean
  page?: number
  pageSize?: number
  sort?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant-asc'
}

export interface ReceiptListResponse {
  data: Receipt[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Calculations & OCR Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung confidence score OCR berdasarkan kelengkapan field yang berhasil diekstrak.
 *
 * Base score: 50%
 * + 15% jika namaToko terbaca (bukan null / 'Tidak Terbaca')
 * + 15% jika nominal > 0
 * + 10% jika tanggal valid
 * + 5% jika receiptNumber terbaca
 * + 5% jika ada minimal 1 item barang
 * Capped at max 98%
 *
 * @param ocrData - data hasil ekstraksi OCR
 */
export function calculateOcrConfidence(ocrData: {
  namaToko?: string | null
  nominal?: number | null
  tanggal?: string | null
  receiptNumber?: string | null
  items?: ReceiptItem[] | null
}): number {
  let score = 50

  if (ocrData.namaToko && ocrData.namaToko.trim() !== '' && ocrData.namaToko !== 'Tidak Terbaca') {
    score += 15
  }
  if (ocrData.nominal && ocrData.nominal > 0) {
    score += 15
  }
  if (ocrData.tanggal && ocrData.tanggal.trim() !== '') {
    score += 10
  }
  if (ocrData.receiptNumber && ocrData.receiptNumber.trim() !== '') {
    score += 5
  }
  if (ocrData.items && ocrData.items.length > 0) {
    score += 5
  }

  return Math.min(98, score)
}

/**
 * Evaluasi status OCR berdasarkan confidence score.
 * BR-OCR-03: confidence ≥ 80% → 'berhasil'
 * BR-OCR-04: 50% ≤ confidence < 80% → 'perlu_review'
 * BR-OCR-05: confidence < 50% → 'gagal'
 */
export function evaluateOcrStatus(confidence: number): Exclude<StatusOcr, 'manual'> {
  return getOcrStatus(confidence)
}

/**
 * Hitung kalkulasi otomatis subtotal per item dan total nominal nota.
 * BR-MAN-03: subtotal = qty × harga
 * BR-MAN-04: total = Σ(subtotal) − diskon + pajak
 *
 * @param items  - daftar item nota
 * @param diskon - nilai diskon dalam rupiah (default: 0)
 * @param pajak  - nilai pajak dalam rupiah (default: 0)
 */
export function calculateReceiptTotals(
  items: Pick<ReceiptItem, 'namaBarang' | 'qty' | 'harga'>[] = [],
  diskon: number = 0,
  pajak: number = 0,
): { itemsWithSubtotal: ReceiptItem[]; totalNominal: number } {
  const itemsWithSubtotal: ReceiptItem[] = items.map((it, idx) => {
    const qty = Math.max(1, Number(it.qty) || 1)
    const harga = Math.max(0, Number(it.harga) || 0)
    const subtotal = calculateItemSubtotal(qty, harga)
    return {
      namaBarang: it.namaBarang || '',
      qty,
      harga,
      subtotal,
      urutan: idx,
      // backward-compat aliases
      name: it.namaBarang || '',
      price: harga,
      total: subtotal,
    }
  })

  const totalNominal = calculateTotal(itemsWithSubtotal, diskon, pajak)

  return { itemsWithSubtotal, totalNominal }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

export const receiptService = {
  /**
   * Ambil daftar nota untuk workspace tertentu (termasuk search & filter).
   * Pertama mencoba fetch dari Supabase, dengan fallback ke local IndexedDB jika offline.
   *
   * @param workspaceId - UUID workspace instansi
   * @param options - filter, sort, pagination
   */
  async getReceipts(
    workspaceId: string,
    options: ReceiptFilterOptions = {},
  ): Promise<ReceiptListResponse> {
    const {
      q = '',
      kategori = null,
      receiptType = null,
      statusOcr = null,
      startDate = null,
      endDate = null,
      minNominal = null,
      maxNominal = null,
      hasImage = false,
      page = 1,
      pageSize = 12,
      sort = 'date-desc',
    } = options

    // 1. Coba fetch dari API /api/receipts (yang sudah menggabungkan Supabase + persistent disk store)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
      })
      if (q) params.set('q', q)
      if (kategori) params.set('kategori', kategori)
      if (receiptType) params.set('receiptType', receiptType)
      if (statusOcr) params.set('statusOcr', statusOcr)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (minNominal !== null && minNominal !== undefined) params.set('minAmount', String(minNominal))
      if (maxNominal !== null && maxNominal !== undefined) params.set('maxAmount', String(maxNominal))
      if (hasImage) params.set('hasImage', 'true')

      const res = await fetch(`/api/receipts?${params}`, {
        headers: { 'x-workspace-id': workspaceId },
      })
      if (res.ok) {
        const json = await res.json()
        if (json && Array.isArray(json.data)) {
          return json
        }
      }
    } catch (apiErr) {
      console.warn('[receiptService.getReceipts] API fetch warning, falling back to direct query:', apiErr)
    }

    const client = createWorkspaceSupabaseClient(workspaceId)

    try {
      let query = client
        .from('receipts')
        .select('*, receipt_items(*)', { count: 'exact' })
        .eq('is_deleted', false)

      if (workspaceId && workspaceId !== 'all') {
        // Only use valid UUIDs to avoid Supabase 22P02 error with non-UUID strings
        query = query.or(`workspace_id.eq.${workspaceId},workspace_id.eq.00000000-0000-4000-a000-000000000000`)
      }

      if (q.trim()) {
        const searchTerm = q.trim()
        query = query.or(`nama_toko.ilike.%${searchTerm}%,receipt_number.ilike.%${searchTerm}%,keterangan.ilike.%${searchTerm}%`)
      }
      if (kategori) query = query.eq('kategori', kategori)
      if (receiptType) query = query.eq('receipt_type', receiptType)
      if (statusOcr) query = query.eq('status_ocr', statusOcr)
      if (hasImage) query = query.not('image_url', 'is', null)
      if (startDate) query = query.gte('tanggal', startDate)
      if (endDate) query = query.lte('tanggal', endDate)
      if (minNominal !== null && minNominal !== undefined) query = query.gte('nominal', minNominal)
      if (maxNominal !== null && maxNominal !== undefined) query = query.lte('nominal', maxNominal)

      // Sort
      switch (sort) {
        case 'date-asc':     query = query.order('tanggal', { ascending: true }); break
        case 'amount-desc':  query = query.order('nominal', { ascending: false }); break
        case 'amount-asc':   query = query.order('nominal', { ascending: true }); break
        case 'merchant-asc': query = query.order('nama_toko', { ascending: true }); break
        case 'date-desc':
        default:             query = query.order('tanggal', { ascending: false })
      }

      // Pagination
      const from = (page - 1) * pageSize
      query = query.range(from, from + pageSize - 1)

      const { data, count, error } = await query

      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data || []) as any[]
      const total = count || 0

      const receipts: Receipt[] = rows.map((r) => {
        const items: ReceiptItem[] = r.receipt_items
          ? r.receipt_items.map((it: any) => ({
              id: it.id,
              receiptId: it.receipt_id,
              namaBarang: it.nama_barang,
              qty: it.qty,
              harga: it.harga,
              subtotal: it.subtotal,
              urutan: it.urutan ?? 0,
              name: it.nama_barang,
              price: it.harga,
              total: it.subtotal,
            }))
          : []
        return {
          ...serializeReceipt(r, items),
          merchantName: r.nama_toko,
          invoiceNumber: r.receipt_number,
          transactionDate: r.tanggal,
          total: r.nominal,
          status: r.status_ocr,
          description: r.keterangan,
          ocrText: r.ocr_raw_text,
          confidence: r.ocr_confidence,
          synced: true,
        }
      })

      if (receipts.length > 0) {
        return {
          data: receipts,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }
      }
    } catch (err) {
      console.warn('[Notabase] Supabase fetch failed, falling back to local IndexedDB:', err)
    }

    // Fallback offline IndexedDB
    try {
      const localResult = await localDb.receipts.toArray()
      const filtered = localResult.filter((r) => !r.isDeleted)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Receipt[] = filtered.map((r: any) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        deviceId: r.deviceId ?? null,
        receiptNumber: r.receiptNumber,
        receiptType: r.receiptType,
        receiptTemplate: r.receiptTemplate ?? null,
        imageUrl: r.imageUrl ?? null,
        tanggal: r.tanggal,
        namaToko: r.namaToko,
        kategori: r.kategori ?? null,
        nominal: r.nominal,
        diskon: r.diskon ?? 0,
        pajak: r.pajak ?? 0,
        metodePembayaran: r.metodePembayaran ?? null,
        keterangan: r.keterangan ?? null,
        statusOcr: r.statusOcr ?? null,
        ocrConfidence: r.ocrConfidence ?? null,
        ocrRawText: r.ocrRawText ?? null,
        isDeleted: r.isDeleted ?? false,
        deletedAt: r.deletedAt ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        items: r.items || [],
        synced: r.synced ?? false,
        // aliases
        merchantName: r.namaToko,
        invoiceNumber: r.receiptNumber,
        transactionDate: r.tanggal,
        total: r.nominal,
        status: r.statusOcr,
      }))

      const total = mapped.length
      const from = (page - 1) * pageSize
      const data = mapped.slice(from, from + pageSize)

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      }
    } catch (dbErr) {
      console.warn('[Notabase] IndexedDB fetch error:', dbErr)
      return { data: [], total: 0, page: 1, pageSize: 12, totalPages: 1 }
    }
  },

  /**
   * Ambil detail 1 nota berdasarkan ID beserta rincian item barangnya.
   *
   * @param id - UUID nota
   */
  async getReceiptById(id: string): Promise<Receipt | null> {
    try {
      const { data: r, error } = await supabase
        .from('receipts')
        .select('*, receipt_items(*)')
        .eq('id', id)
        .single()

      if (error || !r) throw error ?? new Error('Receipt not found')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: ReceiptItem[] = (r as any).receipt_items
        ? (r as any).receipt_items.map((it: any) => ({
            id: it.id,
            receiptId: it.receipt_id,
            namaBarang: it.nama_barang,
            qty: it.qty,
            harga: it.harga,
            subtotal: it.subtotal,
            urutan: it.urutan ?? 0,
            name: it.nama_barang,
            price: it.harga,
            total: it.subtotal,
          }))
        : []

      return {
        ...serializeReceipt(r, items),
        merchantName: r.nama_toko,
        invoiceNumber: r.receipt_number,
        transactionDate: r.tanggal,
        total: r.nominal,
        status: r.status_ocr ?? undefined,
        description: r.keterangan,
        ocrText: r.ocr_raw_text,
        confidence: r.ocr_confidence ?? undefined,
        synced: true,
      }
    } catch {
      // Offline fallback from Dexie
      const local = await localDb.receipts.get(id)
      if (!local) return null
      return {
        id: local.id,
        workspaceId: local.workspaceId,
        deviceId: local.deviceId,
        receiptNumber: local.receiptNumber,
        receiptType: local.receiptType,
        receiptTemplate: local.receiptTemplate,
        imageUrl: local.imageUrl,
        tanggal: local.tanggal,
        namaToko: local.namaToko,
        kategori: local.kategori,
        nominal: local.nominal,
        diskon: local.diskon,
        pajak: local.pajak,
        metodePembayaran: local.metodePembayaran,
        keterangan: local.keterangan,
        statusOcr: local.statusOcr,
        ocrConfidence: local.ocrConfidence,
        ocrRawText: local.ocrRawText,
        isDeleted: local.isDeleted,
        deletedAt: local.deletedAt,
        createdAt: local.createdAt,
        updatedAt: local.updatedAt,
        items: (local.items || []).map((it) => ({
          ...it,
          name: it.namaBarang,
          price: it.harga,
          total: it.subtotal,
        })),
        synced: local.synced,
        merchantName: local.namaToko,
        invoiceNumber: local.receiptNumber,
        transactionDate: local.tanggal,
        total: local.nominal,
        status: local.statusOcr ?? undefined,
      }
    }
  },

  /**
   * Buat nota baru.
   * BR-MAN-01: Auto-generate nomor nota INV-{YYYY}-{seq} jika kosong.
   * BR-MAN-03/04: Hitung otomatis subtotal item & total nominal.
   * BR-MAN-02: Validasi field minimum (tanggal, namaToko, nominal > 0).
   *
   * @param workspaceId - UUID workspace
   * @param data - data nota baru
   */
  async createReceipt(
    workspaceId: string,
    data: {
      receiptNumber?: string | null
      receiptType?: ReceiptType
      receiptTemplate?: string | null
      imageUrl?: string | null
      tanggal?: string
      namaToko: string
      kategori?: string | null
      diskon?: number
      pajak?: number
      metodePembayaran?: string | null
      keterangan?: string | null
      statusOcr?: StatusOcr | null
      ocrConfidence?: number | null
      ocrRawText?: string | null
      items?: Pick<ReceiptItem, 'namaBarang' | 'qty' | 'harga'>[]
      deviceId?: string | null
    },
  ): Promise<Receipt> {
    const year = data.tanggal ? new Date(data.tanggal).getFullYear() : new Date().getFullYear()

    // BR-MAN-01: Auto-generate receipt_number jika tidak diberikan
    const receiptNumber = data.receiptNumber?.trim() || generateReceiptNumber(year, Date.now() % 1000)

    // BR-MAN-03 & BR-MAN-04: Hitung subtotal & total nominal
    const diskon = Math.max(0, data.diskon || 0)
    const pajak = Math.max(0, data.pajak || 0)
    const { itemsWithSubtotal, totalNominal } = calculateReceiptTotals(data.items || [], diskon, pajak)

    const tanggal = data.tanggal || new Date().toISOString().split('T')[0]
    const namaToko = data.namaToko.trim() || 'Tidak Terbaca'

    // BR-OCR-07 / BR-MAN-02: Validasi minimum
    const val = validateReceiptMinimum({ tanggal, namaToko, nominal: totalNominal })
    if (!val.valid) {
      throw new Error(`Validasi nota gagal: ${val.errors.join(', ')}`)
    }

    const client = createWorkspaceSupabaseClient(workspaceId)
    const now = new Date().toISOString()

    const insertPayload = {
      workspace_id: workspaceId,
      device_id: data.deviceId || null,
      receipt_number: receiptNumber,
      receipt_type: data.receiptType || 'manual',
      receipt_template: data.receiptTemplate || null,
      image_url: data.imageUrl || null,
      tanggal,
      nama_toko: namaToko,
      kategori: data.kategori || null,
      nominal: totalNominal,
      diskon,
      pajak,
      metode_pembayaran: data.metodePembayaran || null,
      keterangan: data.keterangan || null,
      status_ocr: data.statusOcr || 'manual',
      ocr_confidence: data.ocrConfidence || null,
      ocr_raw_text: data.ocrRawText || null,
      is_deleted: false,
    }

    try {
      const { data: created, error: createErr } = await client
        .from('receipts')
        .insert(insertPayload as any)
        .select()
        .single()

      if (createErr || !created) throw createErr || new Error('Gagal membuat nota di Supabase')

      // Insert receipt_items
      let insertedItems: ReceiptItem[] = []
      if (itemsWithSubtotal.length > 0) {
        const itemsPayload = itemsWithSubtotal.map((it, idx) => ({
          receipt_id: created.id,
          nama_barang: it.namaBarang,
          qty: it.qty,
          harga: it.harga,
          urutan: idx,
        }))

        const { data: dbItems, error: itemsErr } = await client
          .from('receipt_items')
          .insert(itemsPayload)
          .select()

        if (!itemsErr && dbItems) {
          insertedItems = dbItems.map((it: any) => ({
            id: it.id,
            receiptId: it.receipt_id,
            namaBarang: it.nama_barang,
            qty: it.qty,
            harga: it.harga,
            subtotal: it.subtotal,
            urutan: it.urutan,
            name: it.nama_barang,
            price: it.harga,
            total: it.subtotal,
          }))
        }
      }

      const receiptObj: Receipt = {
        ...serializeReceipt(created, insertedItems),
        merchantName: created.nama_toko,
        invoiceNumber: created.receipt_number,
        transactionDate: created.tanggal,
        total: created.nominal,
        status: created.status_ocr ?? undefined,
        synced: true,
      }

      // Simpan ke IndexedDB lokal juga
      await upsertLocalReceipt({
        id: receiptObj.id,
        workspaceId,
        deviceId: receiptObj.deviceId,
        receiptNumber: receiptObj.receiptNumber,
        receiptType: receiptObj.receiptType,
        receiptTemplate: receiptObj.receiptTemplate,
        imageUrl: receiptObj.imageUrl,
        localImageId: null,
        tanggal: receiptObj.tanggal,
        namaToko: receiptObj.namaToko,
        kategori: receiptObj.kategori,
        nominal: receiptObj.nominal,
        diskon: receiptObj.diskon,
        pajak: receiptObj.pajak,
        metodePembayaran: receiptObj.metodePembayaran,
        keterangan: receiptObj.keterangan,
        statusOcr: receiptObj.statusOcr,
        ocrConfidence: receiptObj.ocrConfidence,
        ocrRawText: receiptObj.ocrRawText,
        isDeleted: false,
        deletedAt: null,
        createdAt: receiptObj.createdAt,
        updatedAt: receiptObj.updatedAt,
        items: itemsWithSubtotal,
        synced: true,
        pendingDelete: false,
        supabaseId: receiptObj.id,
      })

      return receiptObj
    } catch (err) {
      console.warn('[Notabase] Supabase insert failed, saving to local IndexedDB & sync queue:', err)
      const offlineId = crypto.randomUUID()

      const offlineReceipt: Receipt = {
        id: offlineId,
        workspaceId,
        deviceId: data.deviceId || null,
        receiptNumber,
        receiptType: data.receiptType || 'manual',
        receiptTemplate: data.receiptTemplate || null,
        imageUrl: data.imageUrl || null,
        tanggal,
        namaToko,
        kategori: data.kategori || null,
        nominal: totalNominal,
        diskon,
        pajak,
        metodePembayaran: data.metodePembayaran || null,
        keterangan: data.keterangan || null,
        statusOcr: data.statusOcr || 'manual',
        ocrConfidence: data.ocrConfidence || null,
        ocrRawText: data.ocrRawText || null,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        items: itemsWithSubtotal,
        synced: false,
        merchantName: namaToko,
        invoiceNumber: receiptNumber,
        transactionDate: tanggal,
        total: totalNominal,
        status: data.statusOcr || 'manual',
      }

      await upsertLocalReceipt({
        id: offlineId,
        workspaceId,
        deviceId: data.deviceId || null,
        receiptNumber,
        receiptType: data.receiptType || 'manual',
        receiptTemplate: data.receiptTemplate || null,
        imageUrl: data.imageUrl || null,
        localImageId: null,
        tanggal,
        namaToko,
        kategori: data.kategori || null,
        nominal: totalNominal,
        diskon,
        pajak,
        metodePembayaran: data.metodePembayaran || null,
        keterangan: data.keterangan || null,
        statusOcr: data.statusOcr || 'manual',
        ocrConfidence: data.ocrConfidence || null,
        ocrRawText: data.ocrRawText || null,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        items: itemsWithSubtotal,
        synced: false,
        pendingDelete: false,
        supabaseId: null,
      })

      // Queue sync
      await enqueueSyncOp({
        operation: 'create',
        table: 'receipts',
        localId: offlineId,
        workspaceId,
        payload: insertPayload as any,
        createdAt: now,
        retries: 0,
        lastError: err instanceof Error ? err.message : String(err),
      })

      return offlineReceipt
    }
  },

  /**
   * Perbarui data nota (termasuk recalculate subtotal/nominal jika item/diskon/pajak diedit).
   * BR-ARC-02: Seluruh perubahan langsung sinkron ke Supabase + updated_at diperbarui.
   *
   * @param id - UUID nota
   * @param patch - field yang ingin diperbarui
   */
  async updateReceipt(id: string, patch: Partial<Receipt>): Promise<Receipt> {
    const existing = await this.getReceiptById(id)
    if (!existing) throw new Error('Nota tidak ditemukan')

    const workspaceId = existing.workspaceId
    const client = createWorkspaceSupabaseClient(workspaceId)
    const now = new Date().toISOString()

    // Jika items/diskon/pajak diedit, hitung ulang nominal
    const diskon = patch.diskon !== undefined ? Math.max(0, patch.diskon) : existing.diskon
    const pajak = patch.pajak !== undefined ? Math.max(0, patch.pajak) : existing.pajak
    const rawItems = patch.items !== undefined ? patch.items : existing.items || []

    const { itemsWithSubtotal, totalNominal } = calculateReceiptTotals(rawItems, diskon, pajak)

    const updatePayload: Record<string, any> = {
      updated_at: now,
    }

    if (patch.receiptNumber !== undefined) updatePayload.receipt_number = patch.receiptNumber
    if (patch.namaToko !== undefined) updatePayload.nama_toko = patch.namaToko
    if (patch.tanggal !== undefined) updatePayload.tanggal = patch.tanggal
    if (patch.kategori !== undefined) updatePayload.kategori = patch.kategori
    if (patch.metodePembayaran !== undefined) updatePayload.metode_pembayaran = patch.metodePembayaran
    if (patch.keterangan !== undefined) updatePayload.keterangan = patch.keterangan
    if (patch.imageUrl !== undefined) updatePayload.image_url = patch.imageUrl
    if (patch.ocrRawText !== undefined) updatePayload.ocr_raw_text = patch.ocrRawText
    if (patch.ocrConfidence !== undefined) updatePayload.ocr_confidence = patch.ocrConfidence
    if (patch.statusOcr !== undefined) updatePayload.status_ocr = patch.statusOcr
    if (patch.receiptTemplate !== undefined) updatePayload.receipt_template = patch.receiptTemplate
    if (patch.diskon !== undefined || patch.pajak !== undefined || patch.items !== undefined) {
      updatePayload.nominal = totalNominal
      updatePayload.diskon = diskon
      updatePayload.pajak = pajak
    }

    // Aliases fallback
    if (patch.merchantName !== undefined && updatePayload.nama_toko === undefined) updatePayload.nama_toko = patch.merchantName
    if (patch.transactionDate !== undefined && updatePayload.tanggal === undefined) updatePayload.tanggal = patch.transactionDate
    if (patch.total !== undefined && updatePayload.nominal === undefined) updatePayload.nominal = patch.total
    if (patch.description !== undefined && updatePayload.keterangan === undefined) updatePayload.keterangan = patch.description
    if (patch.ocrText !== undefined && updatePayload.ocr_raw_text === undefined) updatePayload.ocr_raw_text = patch.ocrText
    if (patch.confidence !== undefined && updatePayload.ocr_confidence === undefined) updatePayload.ocr_confidence = patch.confidence
    if (patch.status !== undefined && updatePayload.status_ocr === undefined) updatePayload.status_ocr = patch.status

    try {
      const { data: updated, error: updateErr } = await client
        .from('receipts')
        .update(updatePayload as any)
        .eq('id', id)
        .select()
        .single()

      if (updateErr || !updated) throw updateErr || new Error('Gagal memperbarui nota di Supabase')

      // Replace items jika diberikan di patch
      let finalItems = itemsWithSubtotal
      if (patch.items !== undefined) {
        await client.from('receipt_items').delete().eq('receipt_id', id)

        if (itemsWithSubtotal.length > 0) {
          const itemsPayload = itemsWithSubtotal.map((it, idx) => ({
            receipt_id: id,
            nama_barang: it.namaBarang,
            qty: it.qty,
            harga: it.harga,
            urutan: idx,
          }))

          const { data: dbItems } = await client
            .from('receipt_items')
            .insert(itemsPayload)
            .select()

          if (dbItems) {
            finalItems = dbItems.map((it: any) => ({
              id: it.id,
              receiptId: it.receipt_id,
              namaBarang: it.nama_barang,
              qty: it.qty,
              harga: it.harga,
              subtotal: it.subtotal,
              urutan: it.urutan,
              name: it.nama_barang,
              price: it.harga,
              total: it.subtotal,
            }))
          }
        }
      }

      const updatedObj: Receipt = {
        ...serializeReceipt(updated, finalItems),
        merchantName: updated.nama_toko,
        invoiceNumber: updated.receipt_number,
        transactionDate: updated.tanggal,
        total: updated.nominal,
        status: updated.status_ocr ?? undefined,
        synced: true,
      }

      // Sync local Dexie
      await upsertLocalReceipt({
        id,
        workspaceId,
        deviceId: updatedObj.deviceId,
        receiptNumber: updatedObj.receiptNumber,
        receiptType: updatedObj.receiptType,
        receiptTemplate: updatedObj.receiptTemplate,
        imageUrl: updatedObj.imageUrl,
        localImageId: null,
        tanggal: updatedObj.tanggal,
        namaToko: updatedObj.namaToko,
        kategori: updatedObj.kategori,
        nominal: updatedObj.nominal,
        diskon: updatedObj.diskon,
        pajak: updatedObj.pajak,
        metodePembayaran: updatedObj.metodePembayaran,
        keterangan: updatedObj.keterangan,
        statusOcr: updatedObj.statusOcr,
        ocrConfidence: updatedObj.ocrConfidence,
        ocrRawText: updatedObj.ocrRawText,
        isDeleted: updatedObj.isDeleted,
        deletedAt: updatedObj.deletedAt,
        createdAt: updatedObj.createdAt,
        updatedAt: now,
        items: finalItems,
        synced: true,
        pendingDelete: false,
        supabaseId: id,
      })

      return updatedObj
    } catch (err) {
      console.warn('[Notabase] Supabase update failed, updating local Dexie & sync queue:', err)
      const updatedObj: Receipt = {
        ...existing,
        ...patch,
        nominal: totalNominal,
        diskon,
        pajak,
        items: itemsWithSubtotal,
        updatedAt: now,
        synced: false,
      }

      await upsertLocalReceipt({
        id,
        workspaceId,
        deviceId: existing.deviceId,
        receiptNumber: patch.receiptNumber || existing.receiptNumber,
        receiptType: patch.receiptType || existing.receiptType,
        receiptTemplate: patch.receiptTemplate ?? existing.receiptTemplate,
        imageUrl: patch.imageUrl ?? existing.imageUrl,
        localImageId: null,
        tanggal: patch.tanggal || existing.tanggal,
        namaToko: patch.namaToko || existing.namaToko,
        kategori: patch.kategori ?? existing.kategori,
        nominal: totalNominal,
        diskon,
        pajak,
        metodePembayaran: patch.metodePembayaran ?? existing.metodePembayaran,
        keterangan: patch.keterangan ?? existing.keterangan,
        statusOcr: patch.statusOcr ?? existing.statusOcr,
        ocrConfidence: patch.ocrConfidence ?? existing.ocrConfidence,
        ocrRawText: patch.ocrRawText ?? existing.ocrRawText,
        isDeleted: existing.isDeleted,
        deletedAt: existing.deletedAt,
        createdAt: existing.createdAt,
        updatedAt: now,
        items: itemsWithSubtotal,
        synced: false,
        pendingDelete: false,
        supabaseId: existing.synced ? id : null,
      })

      await enqueueSyncOp({
        operation: 'update',
        table: 'receipts',
        localId: id,
        workspaceId,
        payload: updatePayload as any,
        createdAt: now,
        retries: 0,
        lastError: err instanceof Error ? err.message : String(err),
      })

      return updatedObj
    }
  },

  /**
   * Soft delete nota (BR-ARC-01).
   * Tandai `is_deleted = true` dan `deleted_at = now()`.
   * Retensi 30 hari sebelum dipurge otomatis oleh pg_cron.
   *
   * @param id - UUID nota
   */
  async deleteReceipt(id: string): Promise<void> {
    const existing = await this.getReceiptById(id)
    const now = new Date().toISOString()
    const workspaceId = existing?.workspaceId || '00000000-0000-4000-a000-000000000000'
    const client = createWorkspaceSupabaseClient(workspaceId)

    // 1. Hapus dari API route & server disk cache
    try {
      await fetch(`/api/receipts?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-workspace-id': workspaceId },
      })
    } catch (apiErr) {
      console.warn('[Notabase] API delete warning:', apiErr)
    }

    // 2. Hapus dari Supabase database
    try {
      await client.from('receipt_items').delete().eq('receipt_id', id)
      await client.from('receipts').delete().eq('id', id)
      await softDeleteLocalReceipt(id, true)
    } catch (err) {
      console.warn('[Notabase] Supabase delete warning:', err)
      await softDeleteLocalReceipt(id, false)
    }

    // 3. Trigger event update real-time ke seluruh UI & Dashboard
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
    }
  },
}
