'use client'

/**
 * receipt-image-card.tsx
 * A single image card for the gallery grid with hover overlay and badges.
 */

import { motion } from 'framer-motion'
import { ZoomIn, Camera, ImagePlus, FileText, WifiOff } from 'lucide-react'
import { cn, formatRupiah, formatDateShort } from '@/lib/utils'
import type { Receipt } from '@/types'

interface ReceiptImageCardProps {
  receipt: Receipt & { synced?: boolean }
  index: number
  onClick: () => void
}

const SOURCE_BADGE = {
  scan:    { label: 'Scan',   icon: Camera,    color: 'bg-blue-500' },
  gallery: { label: 'Galeri', icon: ImagePlus,  color: 'bg-violet-500' },
  manual:  { label: 'Manual', icon: FileText,   color: 'bg-slate-500' },
} as const

const STATUS_COLOR = {
  verified: 'bg-emerald-500',
  pending:  'bg-amber-400',
  failed:   'bg-red-500',
} as const

export function ReceiptImageCard({ receipt, index, onClick }: ReceiptImageCardProps) {
  const sourceKey = (receipt.receiptType ?? 'scan') as keyof typeof SOURCE_BADGE
  const source = SOURCE_BADGE[sourceKey] ?? SOURCE_BADGE.scan
  const SourceIcon = source.icon

  const statusKey = (receipt.statusOcr || receipt.status || 'berhasil') as string
  const statusColor = statusKey === 'berhasil' || statusKey === 'verified' ? 'bg-emerald-500' : statusKey === 'perlu_review' || statusKey === 'pending' ? 'bg-amber-400' : 'bg-red-500'

  const merchantName = receipt.namaToko || receipt.merchantName || 'Nota'
  const total = receipt.nominal ?? receipt.total ?? 0
  const date = receipt.tanggal || receipt.transactionDate

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="group relative w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 hover:shadow-md hover:ring-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 transition-all text-left"
      aria-label={`Lihat gambar nota ${merchantName}`}
    >
      {/* Image area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        {receipt.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={receipt.imageUrl}
            alt={merchantName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* Placeholder for manual receipts */
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-slate-100">
            <FileText className="h-10 w-10 text-slate-300" />
            <span className="text-[10px] font-medium text-slate-400">Nota Manual</span>
          </div>
        )}

        {/* Hover zoom overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/30">
          <ZoomIn className="h-7 w-7 scale-50 text-white opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" />
        </div>

        {/* Source badge — top left */}
        <span className={cn('absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow', source.color)}>
          <SourceIcon className="h-2.5 w-2.5" />
          {source.label}
        </span>

        {/* Status badge — top right */}
        <span className={cn('absolute right-2 top-2 h-2 w-2 rounded-full shadow-sm', statusColor)} title={statusKey} />

        {/* Unsynced badge — bottom left */}
        {receipt.synced === false && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <WifiOff className="h-2.5 w-2.5" />
            Lokal
          </span>
        )}
      </div>

      {/* Info below image */}
      <div className="px-3 py-2.5">
        <p className="truncate text-xs font-bold text-slate-900">{merchantName}</p>
        <p className="text-[11px] font-semibold text-blue-600">{formatRupiah(total)}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{formatDateShort(date)}</p>
      </div>
    </motion.button>
  )
}
