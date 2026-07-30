/**
 * lib/rules/ocr-rules.ts
 * Implementasi aturan OCR confidence threshold.
 *
 * Dokumen acuan: 03-business-rules.md §2 (BR-OCR-03, BR-OCR-04, BR-OCR-05)
 */

import type { StatusOcr } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds (BR-OCR-03/04/05)
// ─────────────────────────────────────────────────────────────────────────────

/** Confidence ≥ 80% → berhasil, auto-save diizinkan (BR-OCR-03) */
export const OCR_THRESHOLD_HIGH = 80

/** Confidence ≥ 50% → perlu_review, wajib sentuh 1 field (BR-OCR-04) */
export const OCR_THRESHOLD_LOW = 50

// ─────────────────────────────────────────────────────────────────────────────
// Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tentukan status OCR berdasarkan confidence score.
 *
 * @param confidence - nilai 0–100 dari mesin OCR
 * @returns 'berhasil' | 'perlu_review' | 'gagal'
 *
 * BR-OCR-03: confidence ≥ 80% → berhasil
 * BR-OCR-04: 50% ≤ confidence < 80% → perlu_review
 * BR-OCR-05: confidence < 50% → gagal
 */
export function getOcrStatus(confidence: number): Exclude<StatusOcr, 'manual'> {
  if (confidence >= OCR_THRESHOLD_HIGH) return 'berhasil'
  if (confidence >= OCR_THRESHOLD_LOW) return 'perlu_review'
  return 'gagal'
}

/**
 * Apakah nota boleh langsung disimpan tanpa interaksi tambahan dari user?
 *
 * BR-OCR-03: confidence ≥ 80% → boleh langsung simpan.
 * BR-OCR-04: 50-79% → harus sentuh minimal 1 field dulu.
 * BR-OCR-05: < 50% → form manual, tidak boleh auto-save.
 */
export function isAutoSaveAllowed(confidence: number): boolean {
  return confidence >= OCR_THRESHOLD_HIGH
}

/**
 * Apakah form harus menunggu user menyentuh minimal 1 field sebelum Simpan aktif?
 * (BR-OCR-04)
 */
export function requiresUserReview(confidence: number): boolean {
  return confidence >= OCR_THRESHOLD_LOW && confidence < OCR_THRESHOLD_HIGH
}

/**
 * Apakah OCR dianggap gagal total sehingga form dikosongkan dan wajib isi manual?
 * (BR-OCR-05)
 */
export function isOcrFailed(confidence: number): boolean {
  return confidence < OCR_THRESHOLD_LOW
}

/**
 * Badge color key berdasarkan status OCR.
 * Mapping ini dipakai komponen UI (StatusBadge, OcrPreviewView).
 */
export function getOcrBadgeVariant(
  status: StatusOcr | null,
): 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'berhasil':    return 'success'
    case 'perlu_review': return 'warning'
    case 'gagal':       return 'danger'
    case 'manual':
    default:            return 'muted'
  }
}

/**
 * Label Indonesia untuk status OCR (dipakai di badge & laporan).
 */
export function getOcrStatusLabel(status: StatusOcr | null): string {
  switch (status) {
    case 'berhasil':    return 'Selesai'
    case 'perlu_review': return 'Perlu Review'
    case 'gagal':       return 'Gagal'
    case 'manual':      return 'Manual'
    default:            return '—'
  }
}
