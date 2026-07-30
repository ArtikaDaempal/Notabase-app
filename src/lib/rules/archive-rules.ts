/**
 * lib/rules/archive-rules.ts
 * Aturan arsip: soft delete, retensi 30 hari, audit sumber nota.
 *
 * Dokumen acuan: 03-business-rules.md §4 (BR-ARC-01 s.d. BR-ARC-06)
 */

import type { Receipt } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Retensi soft-delete sebelum purge permanen (BR-ARC-01). */
export const SOFT_DELETE_RETENTION_DAYS = 30

// ─────────────────────────────────────────────────────────────────────────────
// Soft Delete (BR-ARC-01)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tandai nota sebagai soft-deleted.
 * BR-ARC-01: set is_deleted = true, deleted_at = now().
 *
 * Fungsi ini mengembalikan objek Receipt yang diperbarui — tidak langsung
 * mengirim ke DB. Caller bertanggung jawab melakukan update ke Supabase /
 * localDb (optimistic update + rollback jika gagal, BR-ARC-02).
 */
export function softDeleteReceipt(receipt: Receipt): Receipt {
  return {
    ...receipt,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Apakah nota ini sudah memenuhi syarat untuk purge permanen?
 * BR-ARC-01: deleted_at < now() − 30 hari.
 *
 * Dipakai oleh: scheduled pg_cron job (SQL-side), dan Edge Function yang
 * menghapus file di Supabase Storage setelah purge.
 */
export function isPurgeable(receipt: Pick<Receipt, 'isDeleted' | 'deletedAt'>): boolean {
  if (!receipt.isDeleted || !receipt.deletedAt) return false

  const deletedAt = new Date(receipt.deletedAt)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SOFT_DELETE_RETENTION_DAYS)

  return deletedAt < cutoff
}

/**
 * Filter daftar nota yang sudah bisa di-purge.
 */
export function filterPurgeable(
  receipts: Pick<Receipt, 'id' | 'isDeleted' | 'deletedAt'>[],
): typeof receipts {
  return receipts.filter(isPurgeable)
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit / Source Badge (BR-ARC-04)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Label & warna badge sumber nota.
 * BR-ARC-04: badge bersifat read-only permanen (tidak berubah walau data lain diedit).
 */
export function getSourceBadge(receiptType: Receipt['receiptType']): {
  label: string
  colorKey: 'blue' | 'purple' | 'slate'
} {
  switch (receiptType) {
    case 'scan':    return { label: 'Scan',   colorKey: 'blue'   }
    case 'gallery': return { label: 'Galeri', colorKey: 'purple' }
    case 'manual':  return { label: 'Manual', colorKey: 'slate'  }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutability rules (BR-ARC-02, BR-ARC-04, BR-ARC-06)
// ─────────────────────────────────────────────────────────────────────────────

/** Field-field yang TIDAK boleh diubah setelah nota dibuat (BR-ARC-04). */
export const IMMUTABLE_FIELDS: ReadonlyArray<keyof Receipt> = [
  'receiptType',   // badge sumber permanen
  'workspaceId',   // isolasi workspace tidak boleh berubah
  'createdAt',
] as const

/**
 * Apakah field ini boleh diedit melalui UI Edit Nota?
 */
export function isFieldEditable(field: keyof Receipt): boolean {
  return !IMMUTABLE_FIELDS.includes(field)
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimistic update helper (BR-ARC-02)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Terapkan patch ke receipt untuk optimistic UI update.
 * Akan digunakan oleh receiptService.update() sebelum mengirim ke Supabase.
 * Jika sync gagal, caller me-rollback ke state sebelumnya.
 *
 * BR-ARC-02: seluruh perubahan langsung sinkron ke Supabase + updated_at diperbarui.
 */
export function applyReceiptPatch(
  receipt: Receipt,
  patch: Partial<Omit<Receipt, 'id' | 'workspaceId' | 'receiptType' | 'createdAt'>>,
): Receipt {
  return {
    ...receipt,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}
