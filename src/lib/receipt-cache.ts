/**
 * lib/receipt-cache.ts
 * Shared singleton in-memory receipt cache across Next.js API routes.
 * Ensures data persistence and instant retrieval for detail/edit views
 * even when Supabase is offline or operating under RLS isolation.
 */

import fs from 'fs'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForCache = globalThis as typeof globalThis & { _notabaseReceiptCache?: Map<string, any>; _cacheLoadedFromDisk?: boolean }

export const receiptCacheMap = globalForCache._notabaseReceiptCache ?? new Map<string, any>()
if (process.env.NODE_ENV !== 'production') {
  globalForCache._notabaseReceiptCache = receiptCacheMap
}

const STORE_PATH = path.join(process.cwd(), '.data', 'local_receipts_store.json')

function loadFromDisk() {
  if (globalForCache._cacheLoadedFromDisk) return
  globalForCache._cacheLoadedFromDisk = true
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8')
      const items = JSON.parse(data)
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            receiptCacheMap.set(item.id, formatReceiptObject(item))
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ReceiptCache] Error loading disk store:', err)
  }
}

function saveToDisk() {
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const items = Array.from(receiptCacheMap.values())
    fs.writeFileSync(STORE_PATH, JSON.stringify(items, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[ReceiptCache] Error saving disk store:', err)
  }
}

import { isValidInvoiceNumber } from '@/lib/utils'

// Initial load
loadFromDisk()

// Helper to format receipt object with all necessary fields & aliases
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatReceiptObject(r: any): any {
  const merchantName = r.merchantName || r.namaToko || r.nama_toko || 'Nota Belanja'
  const rawInv = r.invoiceNumber || r.receiptNumber || r.receipt_number
  const invoiceNumber = isValidInvoiceNumber(rawInv) ? rawInv.trim() : ''
  const transactionDate = r.transactionDate || r.tanggal || new Date().toISOString().split('T')[0]
  const total = Number(r.total ?? r.nominal ?? 0)
  const status = r.status || r.statusOcr || r.status_ocr || 'berhasil'
  const description = r.description || r.keterangan || null
  const ocrText = r.ocrText || r.ocrRawText || r.ocr_raw_text || null
  const confidence = Number(r.confidence ?? r.ocrConfidence ?? r.ocr_confidence ?? 85)
  const imageUrl = r.imageUrl || r.image_url || null
  const items = r.items || []

  return {
    ...r,
    id: r.id,
    workspaceId: r.workspaceId || r.workspace_id || '00000000-0000-4000-a000-000000000000',
    receiptNumber: invoiceNumber,
    invoiceNumber,
    namaToko: merchantName,
    merchantName,
    tanggal: transactionDate,
    transactionDate,
    nominal: total,
    total,
    keterangan: description,
    description,
    imageUrl,
    ocrRawText: ocrText,
    ocrText,
    ocrConfidence: confidence,
    confidence,
    statusOcr: status,
    status,
    items,
    createdAt: r.createdAt || r.created_at || new Date().toISOString(),
    updatedAt: r.updatedAt || r.updated_at || new Date().toISOString(),
  }
}

export const receiptCache = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addReceipt(receipt: any) {
    if (!receipt || !receipt.id) return
    const formatted = formatReceiptObject(receipt)
    receiptCacheMap.set(receipt.id, formatted)
    saveToDisk()
    return formatted
  },

  getReceipt(id: string) {
    if (!id) return null
    loadFromDisk()
    const found = receiptCacheMap.get(id)
    if (!found) return null
    return formatReceiptObject(found)
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateReceipt(id: string, patch: any) {
    if (!id) return null
    const existing = receiptCacheMap.get(id) || {}
    const updated = formatReceiptObject({
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    })
    receiptCacheMap.set(id, updated)
    saveToDisk()
    return updated
  },

  deleteReceipt(id: string) {
    if (!id) return false
    const res = receiptCacheMap.delete(id)
    saveToDisk()
    return res
  },

  getAllReceipts(workspaceId?: string) {
    loadFromDisk()
    const list = Array.from(receiptCacheMap.values()).filter(
      (r) => !r.is_deleted && !r.isDeleted && !r.pendingDelete
    )
    if (!workspaceId || workspaceId === 'all') return list.map(formatReceiptObject)
    const isDefault = (id?: string) => !id || id === 'default-workspace-id' || id === '00000000-0000-4000-a000-000000000000' || id === 'DEFAULT' || id === 'default-workspace'
    const targetIsDefault = isDefault(workspaceId)

    return list
      .filter((r) => {
        const itemWs = r.workspaceId || r.workspace_id
        if (targetIsDefault && isDefault(itemWs)) return true
        return itemWs === workspaceId
      })
      .map(formatReceiptObject)
  },
}
