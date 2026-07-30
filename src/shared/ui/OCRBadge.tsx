/**
 * shared/ui/OCRBadge.tsx
 * Reusable OCR Confidence & Verification Status Badge Component.
 *
 * Dokumen acuan:
 *   02-design-system.md §3.5 (Status OCR: hijau Selesai/Berhasil ≥80%, kuning Perlu Review 50-79%, merah Gagal <50%)
 *   03-business-rules.md (BR-OCR-03..05)
 */

import React from 'react'
import { ShieldCheck, AlertTriangle, XCircle, FileEdit } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusOcr } from '../types/receipt'

export interface OCRBadgeProps {
  /** Status OCR ('berhasil' | 'perlu_review' | 'gagal' | 'manual' atau legacy 'verified' | 'pending' | 'failed') */
  status?: StatusOcr | string | null
  /** Confidence level score (0.00 – 100.00) */
  confidence?: number | null
  /** Ukuran badge ('sm' | 'md' | 'lg') */
  size?: 'sm' | 'md' | 'lg'
  /** Tampilkan persentase confidence level di badge (default: true) */
  showPercentage?: boolean
  className?: string
}

export function OCRBadge({
  status,
  confidence,
  size = 'md',
  showPercentage = true,
  className,
}: OCRBadgeProps) {
  // Normalize status key (support both new DDL status_ocr & legacy status strings)
  const statusKey = (status || 'berhasil').toLowerCase()
  const isBerhasil = statusKey === 'berhasil' || statusKey === 'verified'
  const isPerluReview = statusKey === 'perlu_review' || statusKey === 'pending'
  const isGagal = statusKey === 'gagal' || statusKey === 'failed'

  let label = 'Berhasil'
  let colorStyle = 'border-emerald-200 bg-emerald-50 text-emerald-700'
  let IconComponent = ShieldCheck

  if (isBerhasil) {
    label = 'Berhasil'
    colorStyle = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    IconComponent = ShieldCheck
  } else if (isPerluReview) {
    label = 'Perlu Review'
    colorStyle = 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
    IconComponent = AlertTriangle
  } else if (isGagal) {
    label = 'Gagal'
    colorStyle = 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
    IconComponent = XCircle
  } else {
    label = 'Manual'
    colorStyle = 'border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    IconComponent = FileEdit
  }

  const sizeStyle =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1 rounded-full'
      : size === 'lg'
        ? 'px-3.5 py-1.5 text-sm gap-2 rounded-full font-bold'
        : 'px-2.5 py-1 text-xs gap-1.5 rounded-full font-semibold'

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  const formattedConfidence =
    confidence !== undefined && confidence !== null ? Math.round(confidence) : null

  return (
    <span
      className={cn(
        'inline-flex items-center border font-medium transition-colors shadow-xs',
        colorStyle,
        sizeStyle,
        className,
      )}
      title={
        formattedConfidence !== null
          ? `Status OCR: ${label} (Tingkat Keyakinan: ${formattedConfidence}%)`
          : `Status OCR: ${label}`
      }
      aria-label={`Status OCR: ${label}${formattedConfidence !== null ? `, Keyakinan ${formattedConfidence} persen` : ''}`}
    >
      <IconComponent className={cn('shrink-0', iconSize)} aria-hidden="true" />
      <span>{label}</span>
      {showPercentage && formattedConfidence !== null && (
        <span className="opacity-80 border-l border-current/20 pl-1 font-mono text-[90%]">
          {formattedConfidence}%
        </span>
      )}
    </span>
  )
}
