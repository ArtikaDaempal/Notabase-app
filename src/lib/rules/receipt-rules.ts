/**
 * lib/rules/receipt-rules.ts
 * Aturan perhitungan nota, penomoran otomatis, dan daftar kategori.
 *
 * Dokumen acuan: 03-business-rules.md §3 (BR-MAN-01…06) dan §8 (Kategori)
 */

import type { ReceiptItem } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Kategori Nota (BR §8)
// Tipe TEXT di DB (bukan enum kaku) agar mudah ditambah tanpa migrasi.
// UI menyediakan dropdown dari daftar ini + opsi "Tambah kategori baru".
// ─────────────────────────────────────────────────────────────────────────────

export const KATEGORI_LIST: readonly string[] = [
  'ATK & Kantor',
  'Operasional',
  'Konsumsi',
  'Transportasi',
  'Utilitas',
  'Referensi/Cetak',
  'Lain-lain',
] as const

export type KategoriDefault = typeof KATEGORI_LIST[number]

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Number Generator (BR-MAN-01)
// Format: INV-{YYYY}-{sequence_3digit}  contoh: INV-2025-051
// sequence per workspace per tahun — dimulai dari 1 jika belum ada.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate receipt number dalam format INV-{YYYY}-{###}.
 *
 * @param year  - tahun 4 digit (misal: 2025)
 * @param seq   - nomor urut dalam tahun ini (1-based)
 * @returns     - contoh: "INV-2025-051"
 *
 * BR-MAN-01: otomatis generate jika kosong, tapi tetap bisa diedit manual.
 */
export function generateReceiptNumber(year: number, seq: number): string {
  const paddedSeq = String(seq).padStart(3, '0')
  return `INV-${year}-${paddedSeq}`
}

/**
 * Ekstrak tahun dari receipt_number berformat INV-{YYYY}-{###}.
 * Returns null jika format tidak cocok.
 */
export function parseReceiptNumberYear(receiptNumber: string): number | null {
  const match = receiptNumber.match(/^INV-(\d{4})-\d+$/)
  if (!match) return null
  return parseInt(match[1], 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Item Calculations (BR-MAN-03 & BR-MAN-04)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung subtotal sebuah item.
 * BR-MAN-03: subtotal = qty × harga (computed, read-only di DB)
 */
export function calculateItemSubtotal(qty: number, harga: number): number {
  return roundRupiah(qty * harga)
}

/**
 * Hitung total nota dari daftar item + diskon + pajak.
 * BR-MAN-04: total = Σ(subtotal) − diskon + pajak
 *
 * Diskon dan pajak dapat berupa nilai rupiah langsung.
 * Konversi persen → rupiah dilakukan di UI sebelum memanggil fungsi ini.
 *
 * @param items  - daftar item nota
 * @param diskon - nilai diskon dalam rupiah (>= 0)
 * @param pajak  - nilai pajak dalam rupiah (>= 0)
 * @returns      - total akhir (tidak bisa negatif, minimum 0)
 */
export function calculateTotal(
  items: Pick<ReceiptItem, 'qty' | 'harga'>[],
  diskon: number = 0,
  pajak: number = 0,
): number {
  const subtotalAll = items.reduce(
    (sum, item) => sum + calculateItemSubtotal(item.qty, item.harga),
    0,
  )
  const total = subtotalAll - diskon + pajak
  return roundRupiah(Math.max(0, total))
}

/**
 * Hitung ulang seluruh subtotal dari daftar item.
 * BR-ARC-03: mengubah daftar barang wajib memicu recalculate nominal.
 */
export function recalculateItems(
  items: ReceiptItem[],
): ReceiptItem[] {
  return items.map((item) => ({
    ...item,
    subtotal: calculateItemSubtotal(item.qty, item.harga),
  }))
}

/**
 * Konversi persen diskon/pajak ke nilai rupiah.
 *
 * @param subtotal  - total sebelum diskon/pajak
 * @param persen    - nilai persen (misal: 10 = 10%)
 */
export function persenToRupiah(subtotal: number, persen: number): number {
  return roundRupiah((subtotal * persen) / 100)
}

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Bulatkan ke 2 desimal untuk konsistensi dengan kolom numeric(14,2) di DB. */
export function roundRupiah(value: number): number {
  return Math.round(value * 100) / 100
}

/** Format angka ke format Rupiah Indonesia (Rp 24.750.000). */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation (BR-MAN-02, BR-OCR-07)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validasi field minimum wajib sebelum nota bisa disimpan.
 * BR-OCR-07: tanggal, nama_toko, nominal > 0 wajib ada.
 */
export function validateReceiptMinimum(data: {
  tanggal?: string | null
  namaToko?: string | null
  nominal?: number | null
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.tanggal) errors.push('Tanggal wajib diisi.')
  if (!data.namaToko?.trim()) errors.push('Nama toko wajib diisi.')
  if (!data.nominal || data.nominal <= 0) errors.push('Nominal harus lebih dari 0.')

  return { valid: errors.length === 0, errors }
}

/**
 * Validasi nota manual: minimal 1 item barang (BR-MAN-02).
 */
export function validateManualReceiptItems(items: ReceiptItem[]): boolean {
  return items.length >= 1 && items.every((i) => i.namaBarang.trim() !== '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Export filename (BR-EXP-01)
// ─────────────────────────────────────────────────────────────────────────────

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Generate nama file export Excel.
 * BR-EXP-01: "Laporan_{NamaPeriode}_{Tahun}.xlsx"
 *
 * @param periodType  - jenis periode
 * @param startDate   - tanggal mulai (Date object)
 * @param endDate     - tanggal akhir (Date object), opsional untuk non-rentang
 */
export function generateExportFileName(
  periodType: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'rentang',
  startDate: Date,
  endDate?: Date,
): string {
  const year = startDate.getFullYear()

  let period: string
  switch (periodType) {
    case 'harian':
      period = `${startDate.getDate()}_${BULAN_ID[startDate.getMonth()]}`
      break
    case 'mingguan':
      period = `Minggu_${startDate.toLocaleDateString('id-ID')}`
      break
    case 'bulanan':
      period = BULAN_ID[startDate.getMonth()]
      break
    case 'tahunan':
      period = String(year)
      break
    case 'rentang':
      period = `${startDate.toLocaleDateString('id-ID')}_sd_${(endDate ?? startDate).toLocaleDateString('id-ID')}`
      break
  }

  return `Laporan_${period}_${year}.xlsx`
}
