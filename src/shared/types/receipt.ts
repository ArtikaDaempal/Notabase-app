/**
 * shared/types/receipt.ts
 * TypeScript interfaces & types for Receipts, Receipt Items, and OCR Results.
 * Dokumen acuan: 04-database-schema.md §2, 03-business-rules.md §2..4
 */

import type { ReceiptType, StatusOcr } from './database'

export type { ReceiptType, StatusOcr }

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Item Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Domain interface untuk item nota (tabel `receipt_items`). */
export interface ReceiptItem {
  id?: string             // undefined for unsaved items
  receiptId?: string
  namaBarang: string
  qty: number
  harga: number
  subtotal: number        // computed: qty × harga (BR-MAN-03)
  urutan: number          // display order in preview/print

  // ── Deprecated aliases (backward compatibility) ─────────────────────────
  /** @deprecated Gunakan `namaBarang` */
  name?: string
  /** @deprecated Gunakan `harga` */
  price?: number
  /** @deprecated Gunakan `subtotal` */
  total?: number
}

/** Item nota di IndexedDB lokal. */
export interface LocalReceiptItem {
  namaBarang: string
  qty: number
  harga: number
  subtotal: number
  urutan: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Domain interface untuk Nota / Receipt (tabel `receipts`).
 * Sesuai dengan kolom skema DDL di 04-database-schema.md §2.
 */
export interface Receipt {
  id: string
  workspaceId: string
  deviceId: string | null

  // Identitas nota
  receiptNumber: string
  receiptType: ReceiptType
  receiptTemplate: string | null    // "58mm" | "80mm" | "A4"

  // Gambar
  imageUrl: string | null           // path di Supabase Storage

  // Isi nota
  tanggal: string                   // "YYYY-MM-DD"
  namaToko: string
  kategori: string | null           // lihat KATEGORI_LIST di receipt-rules.ts
  nominal: number                   // total akhir = subtotal − diskon + pajak
  diskon: number
  pajak: number
  metodePembayaran: string | null
  keterangan: string | null

  // OCR metadata (BR-OCR-03 s.d. BR-OCR-06)
  statusOcr: StatusOcr | null
  ocrConfidence: number | null      // 0.00 – 100.00
  ocrRawText: string | null

  // Soft delete (BR-ARC-01)
  isDeleted: boolean
  deletedAt: string | null

  // Audit
  createdAt: string
  updatedAt: string

  // Relasi & metadata
  items?: ReceiptItem[]
  synced?: boolean

  // ── Deprecated aliases (backward compatibility) ─────────────────────────
  /** @deprecated Gunakan `namaToko` */
  merchantName?: string
  /** @deprecated Gunakan `receiptNumber` */
  invoiceNumber?: string | null
  /** @deprecated Gunakan `tanggal` */
  transactionDate?: string
  /** @deprecated Gunakan `nominal` */
  total?: number
  /** @deprecated Gunakan `statusOcr` */
  status?: string
  /** @deprecated Gunakan `keterangan` */
  description?: string | null
  /** @deprecated Gunakan `ocrRawText` */
  ocrText?: string | null
  /** @deprecated Gunakan `ocrConfidence` */
  confidence?: number
}

/** Record nota di IndexedDB `receipts` store. */
export interface LocalReceipt {
  id: string
  workspaceId: string
  deviceId: string | null

  receiptNumber: string
  receiptType: ReceiptType
  receiptTemplate: string | null

  imageUrl: string | null
  localImageId: string | null

  tanggal: string
  namaToko: string
  alamat?: string | null
  noTelepon?: string | null
  kategori: string | null
  nominal: number
  diskon: number
  pajak: number
  metodePembayaran: string | null
  keterangan: string | null

  statusOcr: StatusOcr | null
  ocrConfidence: number | null
  ocrRawText: string | null

  isDeleted: boolean
  deletedAt: string | null

  createdAt: string
  updatedAt: string

  items: LocalReceiptItem[] | null

  synced: boolean
  pendingDelete: boolean
  supabaseId: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR Result Interface
// ─────────────────────────────────────────────────────────────────────────────

/** Output dari ocrService / tesseractWorker (BR-OCR-03..06). */
export interface OcrResult {
  receiptNumber: string | null
  namaToko: string
  alamat?: string | null
  noTelepon?: string | null
  tanggal: string | null
  nominal: number
  keterangan: string | null
  items: ReceiptItem[]
  ocrRawText: string
  confidence: number               // 0 – 100
  status: 'berhasil' | 'perlu_review' | 'gagal'
  isReceipt?: boolean

  // ── Deprecated aliases ──────────────────────────────────────────────────
  /** @deprecated Gunakan `namaToko` */
  merchantName?: string
  merchantAddress?: string | null
  merchantPhone?: string | null
  phone?: string | null
  /** @deprecated Gunakan `receiptNumber` */
  invoiceNumber?: string | null
  /** @deprecated Gunakan `tanggal` */
  transactionDate?: string | null
  /** @deprecated Gunakan `nominal` */
  total?: number
  /** @deprecated Gunakan `keterangan` */
  description?: string | null
  /** @deprecated Gunakan `ocrRawText` */
  ocrText?: string
}
