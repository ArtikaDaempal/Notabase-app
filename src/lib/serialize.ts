import type { Receipt } from '@/types'
import type { ReceiptRow as DbReceiptRow } from '@/types/database.types'

/**
 * serialize.ts
 * Converts Supabase database row (snake_case) to domain Receipt type (camelCase).
 * Dokumen acuan: 04-database-schema.md §2 (tabel receipts)
 */

// Raw row shape from Supabase (superset of DbReceiptRow for compatibility)
export type { DbReceiptRow as ReceiptRow }

/** Convert a Supabase receipt row to the domain Receipt shape */
import { normalizeReceiptItem } from '@/lib/utils'

export function serializeReceipt(
  r: DbReceiptRow,
  items?: Receipt['items'],
): Receipt {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    deviceId: r.device_id,

    receiptNumber: r.receipt_number,
    receiptType: r.receipt_type as Receipt['receiptType'],
    receiptTemplate: r.receipt_template,

    imageUrl: r.image_url,

    tanggal: r.tanggal,
    waktu: (r as any).waktu ?? null,
    namaToko: r.nama_toko,
    alamat: (r as any).alamat ?? null,
    noTelepon: (r as any).no_telepon ?? null,
    nominal: r.nominal,
    subtotalNominal: (r as any).subtotal_nominal ?? undefined,
    diskon: r.diskon,
    pajak: r.pajak,
    biayaTambahan: (r as any).biaya_tambahan ?? 0,
    namaBiayaTambahan: (r as any).nama_biaya_tambahan ?? null,
    keterangan: r.keterangan,

    statusOcr: r.status_ocr as Receipt['statusOcr'],
    ocrConfidence: r.ocr_confidence,
    ocrRawText: r.ocr_raw_text,

    isDeleted: r.is_deleted,
    deletedAt: r.deleted_at,

    createdAt: r.created_at,
    updatedAt: r.updated_at,

    items: items ? items.map((it, idx) => normalizeReceiptItem(it, idx)) : undefined,
  }
}

/** Convert domain Receipt to Supabase insert/update payload */
export function deserializeReceipt(
  r: Partial<Receipt>,
): Partial<DbReceiptRow> {
  const row: Partial<DbReceiptRow> = {}

  if (r.workspaceId !== undefined) row.workspace_id = r.workspaceId
  if (r.deviceId !== undefined) row.device_id = r.deviceId
  if (r.receiptNumber !== undefined) row.receipt_number = r.receiptNumber
  if (r.receiptType !== undefined) row.receipt_type = r.receiptType
  if (r.receiptTemplate !== undefined) row.receipt_template = r.receiptTemplate
  if (r.imageUrl !== undefined) row.image_url = r.imageUrl
  if (r.tanggal !== undefined) row.tanggal = r.tanggal
  if ((r as any).waktu !== undefined) (row as any).waktu = (r as any).waktu
  if (r.namaToko !== undefined) row.nama_toko = r.namaToko
  if ((r as any).alamat !== undefined) (row as any).alamat = (r as any).alamat
  if (r.noTelepon !== undefined) (row as any).no_telepon = r.noTelepon
  if (r.nominal !== undefined) row.nominal = r.nominal
  if (r.subtotalNominal !== undefined) (row as any).subtotal_nominal = r.subtotalNominal
  if (r.diskon !== undefined) row.diskon = r.diskon
  if (r.pajak !== undefined) row.pajak = r.pajak
  if (r.biayaTambahan !== undefined) (row as any).biaya_tambahan = r.biayaTambahan
  if (r.namaBiayaTambahan !== undefined) (row as any).nama_biaya_tambahan = r.namaBiayaTambahan
  if (r.keterangan !== undefined) row.keterangan = r.keterangan
  if (r.statusOcr !== undefined) row.status_ocr = r.statusOcr
  if (r.ocrConfidence !== undefined) row.ocr_confidence = r.ocrConfidence
  if (r.ocrRawText !== undefined) row.ocr_raw_text = r.ocrRawText
  if (r.isDeleted !== undefined) row.is_deleted = r.isDeleted
  if (r.deletedAt !== undefined) row.deleted_at = r.deletedAt

  return row
}
