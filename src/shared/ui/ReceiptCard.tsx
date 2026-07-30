/**
 * shared/ui/ReceiptCard.tsx
 * Reusable Card Component for Displaying a Single Receipt in Grid/List View.
 *
 * Dokumen acuan:
 *   02-design-system.md §3.4 (List Item Nota) & §3.5 (Badge/Pill)
 *   03-business-rules.md (BR-ARC-01: Audit badge sumber nota)
 */

import React from 'react'
import { motion } from 'framer-motion'
import {
  Camera,
  ImagePlus,
  FileText,
  ZoomIn,
  WifiOff,
  Tag,
  Trash2,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { cn, formatRupiah, formatDateShort, isValidInvoiceNumber } from '@/lib/utils'
import { OCRBadge } from './OCRBadge'
import type { Receipt, ReceiptType } from '../types/receipt'

export interface ReceiptCardProps {
  receipt: Receipt & { synced?: boolean }
  index?: number
  onClick?: () => void
  onDelete?: (id: string) => void
  className?: string
  layoutMode?: 'grid' | 'list'
}

const SOURCE_BADGE: Record<
  ReceiptType | 'scan' | 'gallery' | 'manual',
  { label: string; icon: typeof Camera; color: string }
> = {
  scan: { label: 'Scan', icon: Camera, color: 'bg-blue-600 text-white' },
  gallery: { label: 'Galeri', icon: ImagePlus, color: 'bg-purple-600 text-white' },
  manual: { label: 'Manual', icon: FileText, color: 'bg-slate-600 text-white' },
}

const KATEGORI_TAG_COLOR: Record<string, string> = {
  ATK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Konsumsi: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  Operasional: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  Transportasi: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Utilitas: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  Referensi: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  Lainnya: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

export function ReceiptCard({
  receipt,
  index = 0,
  onClick,
  onDelete,
  className,
  layoutMode = 'grid',
}: ReceiptCardProps) {
  const merchantName = receipt.namaToko || receipt.merchantName || 'Nota'
  const rawInv = receipt.receiptNumber || receipt.invoiceNumber
  const receiptNumber = isValidInvoiceNumber(rawInv) ? rawInv : ''
  const dateStr = receipt.tanggal || receipt.transactionDate
  const totalAmount = receipt.nominal ?? receipt.total ?? 0
  const kategori = receipt.kategori || 'Lainnya'

  const sourceKey = (receipt.receiptType ?? 'scan') as keyof typeof SOURCE_BADGE
  const source = SOURCE_BADGE[sourceKey] ?? SOURCE_BADGE.scan
  const SourceIcon = source.icon

  const tagColorStyle =
    KATEGORI_TAG_COLOR[kategori] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

  if (layoutMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        onClick={onClick}
        className={cn(
          'group relative flex items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 transition-all cursor-pointer text-left',
          className,
        )}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Thumbnail image or icon */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200/60 dark:border-slate-700">
            {receipt.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.imageUrl}
                alt={merchantName}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            ) : (
              <FileText className="h-6 w-6 text-slate-400" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 font-mono">{receiptNumber}</span>
              <OCRBadge status={receipt.statusOcr || receipt.status} confidence={receipt.ocrConfidence} size="sm" showPercentage={false} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {merchantName}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                {formatDateShort(dateStr)}
              </span>
              <span>·</span>
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', tagColorStyle)}>
                {kategori}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="block text-sm font-extrabold text-blue-600 dark:text-blue-400">
              {formatRupiah(totalAmount)}
            </span>
            {receipt.synced === false && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <WifiOff className="h-2.5 w-2.5" /> Lokal
              </span>
            )}
          </div>

          {onDelete ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(receipt.id)
              }}
              className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
              title="Hapus Nota"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 active:scale-98 transition-all cursor-pointer text-left flex flex-col',
        className,
      )}
    >
      {/* Image area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {receipt.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={receipt.imageUrl}
            alt={merchantName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Nota Manual</span>
          </div>
        )}

        {/* Hover zoom overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/30">
          <ZoomIn className="h-7 w-7 scale-50 text-white opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" />
        </div>

        {/* Source badge — top left */}
        <span
          className={cn(
            'absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-xs',
            source.color,
          )}
        >
          <SourceIcon className="h-2.5 w-2.5" />
          {source.label}
        </span>

        {/* OCR Status badge — top right */}
        <div className="absolute right-2.5 top-2.5">
          <OCRBadge
            status={receipt.statusOcr || receipt.status}
            confidence={receipt.ocrConfidence}
            size="sm"
            showPercentage={false}
          />
        </div>

        {/* Unsynced badge — bottom left */}
        {receipt.synced === false && (
          <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
            <WifiOff className="h-2.5 w-2.5" />
            Lokal
          </span>
        )}
      </div>

      {/* Info below image */}
      <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span className="font-mono">{receiptNumber}</span>
            <span>{formatDateShort(dateStr)}</span>
          </div>
          <h4 className="truncate text-xs font-bold text-slate-900 dark:text-slate-100" title={merchantName}>
            {merchantName}
          </h4>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold', tagColorStyle)}>
            {kategori}
          </span>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
            {formatRupiah(totalAmount)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
