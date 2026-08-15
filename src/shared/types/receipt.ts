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
  keterangan?: string | null // catatan per-item (opsional)

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
  keterangan?: string | null
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
  waktu?: string | null             // jam transaksi "HH:MM"
  namaToko: string
  alamatToko?: string | null        // alias bersih untuk alamat toko
  nominal: number                   // total akhir = subtotal − diskon + pajak
  diskon: number
  diskonNominal?: number            // diskon dalam Rupiah
  diskonPersen?: number             // diskon dalam persen
  pajak: number
  pajakNominal?: number             // pajak dalam Rupiah
  pajakPersen?: number              // pajak dalam persen
  biayaTambahan?: number            // biaya admin/transaksi tambahan
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
  waktu?: string | null
  namaToko: string
  alamat?: string | null
  alamatToko?: string | null
  nominal: number
  diskon: number
  diskonNominal?: number
  diskonPersen?: number
  pajak: number
  pajakNominal?: number
  pajakPersen?: number
  biayaTambahan?: number
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
  noTelepon?: string | null         // nomor telepon toko/merchant
  tanggal: string | null
  waktu?: string | null             // jam transaksi "HH:MM"
  nominal: number
  subtotalNominal?: number          // subtotal sebelum diskon/pajak/biaya tambahan
  diskon?: number                   // diskon (nominal Rp)
  diskonPersen?: number             // diskon (%)
  pajak?: number                    // pajak nominal Rp
  pajakPersen?: number              // pajak (%)
  biayaTambahan?: number            // biaya admin/transaksi
  namaBiayaTambahan?: string | null // label biaya tambahan (mis. "Service Charge", "Biaya Admin")
  metodePembayaran?: string | null
  keterangan: string | null
  items: ReceiptItem[]
  ocrRawText: string
  confidence: number               // 0 – 100
  /** Per-field confidence scores 0-100. Key = nama field, value = confidence-nya. */
  fieldConfidences?: Record<string, number>
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
