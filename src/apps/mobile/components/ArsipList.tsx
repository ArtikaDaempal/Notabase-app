/**
 * apps/mobile/components/ArsipList.tsx
 * Mobile Receipt Archive List & Grid View Component (02-design-system.md §3.4 & §4).
 *
 * Supports List vs Grid View Toggle, Skeleton Loaders, and Empty State.
 */

import React, { useState } from 'react'
import { LayoutGrid, List, FileText, Camera, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReceiptCard } from '@/shared/ui/ReceiptCard'
import { cn } from '@/lib/utils'
import type { Receipt } from '@/shared/types/receipt'

export interface ArsipListProps {
  receipts: Receipt[]
  isLoading?: boolean
  onSelectReceipt: (id: string) => void
  onDeleteReceipt?: (id: string) => void
  onScanClick?: () => void
  className?: string
}

export function ArsipList({
  receipts,
  isLoading = false,
  onSelectReceipt,
  onDeleteReceipt,
  onScanClick,
  className,
}: ArsipListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── View Toggle Header ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Daftar Nota ({receipts.length})
        </span>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/60 dark:border-slate-700">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors',
              viewMode === 'grid' && 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold',
            )}
            title="Tampilan Grid"
            aria-label="Tampilan Grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors',
              viewMode === 'list' && 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold',
            )}
            title="Tampilan List"
            aria-label="Tampilan List"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Skeleton Loading State ── */}
      {isLoading ? (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
              : 'space-y-3',
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2',
                viewMode === 'list' && 'flex items-center gap-3 space-y-0',
              )}
            >
              <Skeleton className={cn(viewMode === 'grid' ? 'aspect-[3/4] w-full rounded-xl' : 'h-14 w-14 rounded-xl')} />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : receipts.length > 0 ? (
        /* ── Receipt Grid or List ── */
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
              : 'space-y-3',
          )}
        >
          {receipts.map((r, idx) => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              index={idx}
              layoutMode={viewMode}
              onClick={() => onSelectReceipt(r.id)}
              onDelete={onDeleteReceipt}
            />
          ))}
        </div>
      ) : (
        /* ── Empty State (02-design-system.md §3.9) ── */
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Belum Ada Nota Tersimpan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Pindai nota baru dengan kamera HP Anda atau cari dengan kriteria filter lain.
            </p>
          </div>
          {onScanClick && (
            <Button
              onClick={onScanClick}
              className="rounded-xl h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
            >
              <Camera className="h-4 w-4" />
              Scan Nota Sekarang
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
